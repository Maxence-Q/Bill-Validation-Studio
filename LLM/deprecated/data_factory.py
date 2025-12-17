# data_factory.py
from __future__ import annotations
import json, random, requests
from typing import Any, Dict, List, Optional, Tuple
import yaml

# langsmith
from langsmith.run_helpers import traceable, trace

from LLM.deprecated.llm_final_module import FinalLLMValidator
from utils.utils import _jsonable, load_all_ids, get_ts_api
from RAG.rag import similar_by_id
from utils.modules_initializer import initialize_modules
from utils.rules_loader import collect_for_module
from utils.routes_loader import collect_routes_for_module
from utils.history_loader import build_history_for_module

class DataFactory:
    """
    Orchestrateur ‘données’ : IDs, API, extraction de sections + simulation.
    Dépend d’un LLMFinalValidator (injection par constructeur).
    """

    def __init__(self):
        # --- Nouveaux attributs pour les modules LLM ---
        self.modules: Dict[str, FinalLLMValidator] = {}     # name -> instance (LLM)
        self.modules_meta: Dict[str, Dict[str, Any]] = {}   # name -> metadata (title, rules, etc.)
        self.execution_order: List[str] = []                # orchestration.execution_order

        # cache des full configs similaires
        self._similar_full: dict[int, dict[int, dict]] = {}

    # ---------- chargement IDs ----------
    def load_all_ids(self, path: str = "samples/all_events.json") -> List[int]:
        return load_all_ids(path=path)
    # ---------- API ----------
    def get_full_config(self, event_id: int) -> Dict[str, Any]:
        return get_ts_api(event_id)

    # ---------- similar events ----------
    def get_similar_events(self, event_id: int, k: int = 4) -> list[int]:
        """Trouve 4 events similaires (via all_events.json),
        fetch leurs FULL configs via get_ts_api, les stocke en cache interne,
        et retourne uniquement les 4 IDs (pour l'UI)."""
        _,ids = similar_by_id(eid = event_id, top_k=k, display=False)
        store: dict[int, dict] = {}
        for sid in ids:
            try:
                store[sid] = self.get_full_config(sid)
            except Exception as e:
                # Option: log, et continuer pour les autres
                store[sid] = {"error": str(e)}
        self._similar_full[event_id] = store
        return ids

    def get_cached_similar_full(self, event_id: int) -> dict[int, dict]:
        return self._similar_full.get(event_id, {})

    # ---------- initialisation des modules LLM ----------
    def modules_initializer(self,
        yaml_path: str = "artefacts/llm_modules.yaml",
        *,
        default_model: str = "openai/gpt-oss-120b",
    ) -> None:
        """Wrapper autour de utils.modules_initializer.initialize_modules."""
        modules, order = initialize_modules(
            self,
            yaml_path=yaml_path,
            default_model=default_model,
        )

        self.execution_order = [str(x) for x in order]
    
        self.modules.clear()
        self.modules_meta.clear()

        for name, meta in modules.items():
            if not isinstance(meta, dict):
                continue
            # stocker les metas brutes (title, rules, stage_hint, depends_on, description, ...)
            self.modules_meta[name] = dict(meta)

            # instancier le LLM (placeholder commun pour l’instant)
            # si besoin, choisir un autre model par module via meta plus tard
            self.modules[name] = FinalLLMValidator(model=default_model)

    # ---------- helpers d’inspection ----------
    def list_modules(self) -> List[str]:
        """Nom des modules LLM chargés."""
        return list(self.modules.keys())

    def get_module_meta(self, name: str) -> Dict[str, Any]:
        return dict(self.modules_meta.get(name, {}))

    # ---------- contextes pour modules ----------
    def build_contexts_for_all_modules(
        self,
        *,
        event_full: Dict[str, Any],
        rules_mapping: Dict[str, Any],
        event_id: Optional[int] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Construit self.current_ctx pour CHAQUE module de self.modules,
        en filtrant les rules/fields pertinents via rules_mapping.
        Retourne {module_id -> ctx}.

        - event_full: FULL config d'un évènement
        - rules_mapping: YAML déjà chargé en dict (rules + groups avec 'module')
        - event_id: optionnel, pour meta
        """
        contexts: Dict[str, Dict[str, Any]] = {}

        # On respecte l'ordre si disponible, sinon on itère sur les clés
        module_ids: List[str] = (
            list(self.execution_order) if getattr(self, "execution_order", None) else list(self.modules.keys())
        )

        for module_id in module_ids:
            validator = self.modules.get(module_id)

            rule_ids, field_paths, groups = collect_for_module(rules_mapping, module_id)

            # 2) Construire le contexte courant du module (snapshot)
            if validator is not None:
                ctx = validator.set_current_context(
                    module_id=module_id,
                    event_full=event_full,
                    rule_ids=rule_ids,
                    field_paths=field_paths,
                    event_id=event_id,
                    source="get_full_config",
                )
                contexts[module_id] = ctx

        return contexts

    # ---------- history (similaires) pour modules ----------
    def build_history_for_all_modules(
        self,
        *,
        event_id: int,
        extra_paths: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Construit une 'history_ctx' pour CHAQUE module à partir du cache des full configs similaires
        et des chemins 'fields' listés dans le current_ctx du module.

        Retourne { module_id: history_ctx } où history_ctx suit le format:
          {
            "fields": [...],
            "similar_events": [{"id": <int>, "fields": {...}}, ...],
            "stats": { <path>: {...} }
          }
        """
        out: Dict[str, Dict[str, Any]] = {}
        similar_map = (self._similar_full or {}).get(event_id, {}) or {}  # {similar_id: full_config}

        for module_id, validator in (self.modules or {}).items():
            # On suppose que chaque module a déjà un current_ctx avec .get("fields", {})
            current_ctx = getattr(validator, "current_ctx", {}) or {}

            # Construit l'historique ciblé
            history_ctx = build_history_for_module(
                similar_full=similar_map,
                current_ctx=current_ctx,
                extra_paths=extra_paths,
            )

            # Attache au validateur et mémorise
            try:
                validator.set_history_context(history_ctx)
            except Exception:
                # on n'empêche pas les autres modules
                pass

            out[module_id] = history_ctx

        return out

    # ---------- business data (API) pour modules ----------
    def attach_business_data_to_all_modules(
        self,
        *,
        modules_routes: Dict[str, Any],
        event_full: Dict[str, Any],
        event_id: Optional[int] = None,
        context_vars: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Pour chaque module de self.modules:
          - prépare la liste des routes obligatoires (optional != true) via routes_loader
          - appelle validator.set_business_data(...) pour attacher ces infos métiers
        Retourne {module_id -> business_data_dict}.
        """
        modules_business_data: Dict[str, Dict[str, Any]] = {}

        # ordre préféré ; fallback = clés des modules
        module_ids: List[str] = (
            list(self.execution_order) if getattr(self, "execution_order", None) else list(self.modules.keys())
        )


        for module_id in module_ids:
            validator = self.modules.get(module_id)
            
            routes = collect_routes_for_module(modules_routes, module_id,event_full_config=event_full)

            if validator is not None:
                bus_data = validator.set_business_data(
                    module_id=module_id,
                    routes=routes
                )
                modules_business_data[module_id] = bus_data

        return modules_business_data

    # ---------- policy et user prompt pour modules ----------
    def attach_module_policy(self, modules_policy: Dict[str, Any]) -> Dict[str, str]:
        """
        Assigne une policy spécifique à chaque module si disponible.
        modules_policy doit avoir la forme:
          { "modules": { "<module_id>": { "policy": "<texte>"} } }
        Retourne un dict {module_id: "OK"|"MISSING"} pour feedback rapide.
        """
        policies: Dict[str, str] = {}
        mp = (modules_policy or {}).get("modules", {}) or {}

        for module_id, validator in (self.modules or {}).items():
                policy = (mp.get(module_id) or {}).get("policy")
                if policy:
                    validator.set_policy(policy)
                    policies[module_id] = policy

        return policies

    # ---------- user prompt pour modules ----------
    def attach_module_user_prompt(
        self,
        *,
        event_id: Optional[int] = None,
        extra: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """
        Construit et assigne un user prompt pour CHAQUE module (validator.set_user_prompt).
        - Si event_id est fourni et que les contexts sont prêts, on construit d'abord l'historique
          via build_history_for_all_modules(event_id=...).
        - Retourne {module_id: prompt} pour inspection/log.
        """
        # 1) Optionnel: bâtir l'historique si on a un event_id et des contexts prêts
        if event_id is not None:
            try:
                self.build_history_for_all_modules(event_id=event_id)
            except Exception:
                # on n'empêche pas la suite si l'historique échoue
                pass
        out: Dict[str, str] = {}
        modules = getattr(self, "modules", {}) or {}
        for module_id, validator in modules.items():
            try:
                prompt = validator.set_user_prompt(module_id, extra=extra)
                out[module_id] = prompt
            except Exception as e:
                out[module_id] = f"[ERROR building user prompt: {type(e).__name__}: {e}]"
        return out

    # ----------- call llm ---------
    def call_llm(self) -> Dict[str, str]:
        """
        Appelle le LLM pour chaque module via validator.validate_section(),
        et renvoie {module_id: reponse_str}.
        - Utilise self.execution_order si présent pour l'ordre d'itération.
        - Capture les exceptions module par module (n'interrompt pas la boucle).
        - Mémorise aussi le résultat dans self.last_llm_results pour debug/inspection.
        """
        out: Dict[str, str] = {}
        modules = getattr(self, "modules", {}) or {}

        # ordre stable : préférer self.execution_order si dispo
        order = getattr(self, "execution_order", None)
        if order:
            items = [(mid, modules[mid]) for mid in order if mid in modules]
            # inclure les modules non listés dans execution_order, en fin
            items += [(mid, v) for mid, v in modules.items() if mid not in dict(items)]
        else:
            items = list(modules.items())

        for module_id, validator in items:
            with trace(name=f"validate[{module_id}]", run_type="llm",
                    inputs={"module_id": module_id}) as run:
                resp_str = validator.validate_section()  # doit retourner une str
                out[module_id] = resp_str if isinstance(resp_str, str) else str(resp_str)
                run.add_outputs({"pred": resp_str})

        # Optionnel: garder en mémoire le dernier run pour inspection UI / logs
        try:
            self.last_llm_results = out  # type: ignore[attr-defined]
        except Exception:
            pass

        return out

if __name__ == "__main__":

    df = DataFactory()
    df.modules_initializer("artefacts/llm_modules.yaml")  # charge, set execution_order, instancie les LLM
    #print(df.execution_order)   # ['temporalite', 'plan_capacite', ..., 'final_validation']
    #print(df.list_modules())    # mêmes clés que modules du YAML
    #print(df.get_module_meta("temporalite"))  # {'title': 'Temporalité', 'rules': [...], ...}


    
    event_id = 1234
    event_full = df.get_full_config(event_id)


    with open("artefacts/rules_mapping.yaml", "r", encoding="utf-8") as f:
        rules_mapping = yaml.safe_load(f)

    # 1) Construire uniquement les contextes (avec prompts)
    contexts = df.build_contexts_for_all_modules(
        event_full=event_full,
        rules_mapping=rules_mapping,
        event_id=event_id,
    )

    #print(json.dumps(contexts["temporalite"], indent=2, ensure_ascii=False))

    with open("artefacts/modules_routes.yaml", "r", encoding="utf-8") as f:
        modules_routes = yaml.safe_load(f)

    # 2) Attacher les business data (API) à chaque module
    business_data = df.attach_business_data_to_all_modules(modules_routes=modules_routes, event_full=event_full)

    #print(json.dumps(business_data["internet"], indent=2, ensure_ascii=False))

    with open("artefacts/modules_policy.yaml", "r", encoding="utf-8") as f:
        modules_policy = yaml.safe_load(f)

    policies_status = df.attach_module_policy(modules_policy=modules_policy)
    print(policies_status["temporalite"])  # {'temporalite': 'OK', 'plan