# eval_langsmith.py
import json, yaml
import os
import random
from datetime import datetime, timezone
from langsmith.run_trees import RunTree
from langsmith.run_helpers import traceable, trace
from langsmith import Client

from data_factory import DataFactory


ANNOT_POLICY = {
    "temporalite": True,
    "tarifs_client": False,
    "pos_frais": False,
    "internet": False,
    "plan_capacite":False,
    "ids_tags": False,
    "final_validation": False
    # défaut: True si module inconnu
}

def should_annotate(module_id: str) -> bool:
    return ANNOT_POLICY.get(module_id, True)


@traceable(name="pipeline", run_type="chain", tags=["eval"])
def pipeline(event_id: int = 7175) -> dict:
    # initialize DataFactory
    DF = DataFactory()

    # initialize modules
    with trace(name="modules_initializer", run_type="tool",
               inputs={"path": "artefacts/llm_modules.yaml"}) as r:
        DF.modules_initializer("artefacts/llm_modules.yaml")

    # prepare event
    with trace(name="get_full_config", run_type="tool",
               inputs={"event_id": event_id}) as r:
        event_full_config = DF.get_full_config(event_id=event_id)
        r.add_outputs({"keys": list(event_full_config.keys())[:8]})

    # find similar events
    with trace(name="get_similar_events", run_type="tool",
               inputs={"event_id": event_id}) as r:
        sm_ev_ids = DF.get_similar_events(event_id=event_id)
        r.add_outputs({"count": len(sm_ev_ids)})


    # on prépare le contexte pour tous les modules
    with trace(name="build_contexts_for_all_modules", run_type="chain",
               inputs={"event_id": event_id}) as r:
        rules_mapping = yaml.safe_load(open("artefacts/rules_mapping.yaml", encoding="utf-8"))
        DF.build_contexts_for_all_modules(event_full=event_full_config,
                                          rules_mapping=rules_mapping,
                                          event_id=event_id)

    # on attache les policies
    with trace(name="attach_module_policy", run_type="tool") as r:
        modules_policy = yaml.safe_load(open("artefacts/modules_policy.yaml", encoding="utf-8"))
        policies_status = DF.attach_module_policy(modules_policy=modules_policy)
        r.add_outputs({"status": policies_status})

    # on attache les user prompts
    with trace(name="attach_module_user_prompt", run_type="chain",
               inputs={"event_id": event_id}) as r:
        prompts_map = DF.attach_module_user_prompt(event_id=event_id)
        r.add_outputs({"modules": list(prompts_map.keys())})

    # appels LLM
    with trace(name="call_llm", run_type="llm",
               inputs={"note": "validation par modules"}) as r:
        resp_map = DF.call_llm()
        r.add_outputs({"len_response_str": len(str(resp_map))})


    all_results = {
        mid: {
            "event_id": event_id,
            "similar_event_ids": sm_ev_ids,
            "responses": resp_map.get(mid),
            "policies_status": policies_status.get(mid),
            "prompts_map": prompts_map.get(mid),
        }
        for mid in resp_map.keys()
    }

    # --- AJOUT : journalisation LangSmith ---
    try:
        if os.environ.get("LANGSMITH_TRACING", "").lower() in ("true", "1", "yes"):
            client = Client()

            # Date locale (YYYYMMDD) pour le nommage des runs
            # -> prend le tz local de la machine, fallback UTC si besoin
            try:
                today_str = datetime.now().astimezone().strftime("%Y%m%d")
            except Exception:
                today_str = datetime.now(timezone.utc).strftime("%Y%m%d")

            for module_id, mod_res in all_results.items():
                # Projet de tracing dédié à ce module
                module_project = f"Event Validating Module {module_id}"

                raw = mod_res.get("responses")
                responses = json.loads(raw) if isinstance(raw, str) else (raw or {})
                issues = responses.get("issues", [])

                # Une trace top-level PAR ISSUE, directement dans le projet du module
                for i, issue in enumerate(issues):
                    # Nom du run = {event_id}-{YYYYMMDD}-{issue_idx}
                    issue_run_name = f"{event_id}-{today_str}-{i:03d}"

                    annot = should_annotate(module_id)

                    # Inputs concis et utiles pour filtrer côté UI
                    issue_inputs = {
                        "event_id": event_id,
                        "module_id": module_id,
                        "path": issue.get("path"),
                        "message": issue.get("message"),
                        "severity": issue.get("severity"),
                        "suggestion": issue.get("suggestion"),
                    }

                    r = RunTree(
                        name=issue_run_name,
                        run_type="tool",                 # unité à annoter
                        project_name=module_project,     # <- projet spécifique au module
                        inputs=issue,
                        tags=["issue", module_id, issue.get("severity", "unknown"),"annot:on" if annot else "annot:off",]
                    )
                    r.post()
                    r.end()
                    # Rien d’autre: chaque issue est un run isolé,
                    # prêt à être rattaché à un dataset/annotation queue via l’UI.
                    r.patch() 

    except Exception as e:
        print(f"[LangSmith] logging skipped: {e}")
    # --- FIN AJOUT ---
    return all_results

if __name__ == "__main__":
    full_output = pipeline()
