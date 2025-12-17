
from __future__ import annotations
from typing import Dict, List, TypedDict, Optional
from openai import OpenAI
import os, json, sys
from pathlib import Path
import datetime, re

from utils.utils import _jsonable

# --- Tool schema -------------------------
TOOLS_VALIDATOR = [{
    "type": "function",
    "function": {
        "name": "report_inconsistencies",
        "description": "Analyse un évènement COMPLET et renvoie une liste d'incohérences, avec sévérité et correctifs proposés.",
        "parameters": {
            "type": "object",
            "properties": {
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "rule_id":   {"type": "string", "description": "Ex.: RULE20"},
                            "section":   {"type": "string", "description": "Ex.: PriceGroups"},
                            "path":      {"type": "string", "description": "Chemin JSON (ex: Event.Event.IsInSale)"},
                            "field":     {"type": "string"},
                            "severity":  {"type": "string", "enum": ["error", "warning", "info"]},
                            "message":   {"type": "string"},
                            "expected":  {"type": "string", "description": "Valeur/état attendu"},
                            "found":     {"type": "string", "description": "Valeur/état observé"},
                            "suggestion":{"type": "string"},
                            "evidence":  {"type": "string"}
                        },
                        "required": ["rule_id","path","field","severity","message"]
                    }
                }
            },
            "required": ["issues"]
        }
    }
}]

class LLMFinalValidator:
    """
    Valide un évènement complet en l'envoyant tel quel au LLM, et retourne
    une liste structurée d'incohérences potentielles (erreurs/avertissements/infos).

    - S'appuie sur un tool call 'report_inconsistencies' (même approche que llm_selector.py).
    - Compatible Groq/OpenAI (client OpenAI avec base_url Groq si GROQ_API_KEY est présent).
    """

    def __init__(self, model: str = "llama-3.1-8b-instant"):
        self.client = OpenAI(
            api_key=os.environ.get("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1"
        )
        self.model = model
    
    @staticmethod
    def summarize_event_keys(
        e: Dict,
        *,
        max_preview: int = 40,
        max_lines: int = 1500,     # borne dure globale
        max_depth: int = 2,        # profondeur (0 = top-level)
        max_list_items: int = 1    # combien d’items d’exemple dans les listes
    ) -> str:
        def detect_type(v):
            if isinstance(v, bool): return "bool"
            if isinstance(v, int): return "int"
            if isinstance(v, float): return "float"
            if isinstance(v, str):
                if any(t in v for t in ("T", "-", ":", "Z")) and len(v) >= 10:
                    return "date|str"
                return "str"
            if v is None: return "null"
            if isinstance(v, list): return "list"
            if isinstance(v, dict): return "dict"
            return type(v).__name__

        lines = []

        def add_line(path, v):
            t = detect_type(v)
            if isinstance(v, str):
                pv = v
            else:
                try:
                    pv = json.dumps(v, ensure_ascii=False) if not isinstance(v, (dict, list)) else ""
                except Exception:
                    pv = str(v)
            if pv:
                if len(pv) > max_preview:
                    pv = pv[:max_preview] + "…"
                lines.append(f"- {path}: {t} | ex: {pv}")
            else:
                lines.append(f"- {path}: {t}")

        def walk(obj, path="", depth=0):
            nonlocal lines
            if len(lines) >= max_lines:
                return
            if isinstance(obj, dict):
                for k, v in obj.items():
                    new_path = f"{path}.{k}" if path else k
                    if isinstance(v, (dict, list)) and depth < max_depth:
                        # ligne d’en-tête de section
                        lines.append(f"- {new_path}: {detect_type(v)}")
                        if len(lines) >= max_lines: return
                        walk(v, new_path, depth + 1)
                    else:
                        add_line(new_path, v)
                    if len(lines) >= max_lines:
                        return
            elif isinstance(obj, list):
                lines.append(f"- {path}: list | len≈{len(obj)}")
                if len(lines) >= max_lines: return
                # on ne résume que quelques items d’exemple
                for i, item in enumerate(obj[:max_list_items]):
                    item_path = f"{path}[{i}]"
                    if isinstance(item, (dict, list)) and depth < max_depth:
                        walk(item, item_path, depth + 1)
                    else:
                        add_line(item_path, item)
                    if len(lines) >= max_lines:
                        return
            else:
                add_line(path or "<root>", obj)

        walk(e, "", 0)
        if len(lines) >= max_lines:
            lines.append(f"... (tronqué à {max_lines} lignes)")
        return "\n".join(lines)



    def validate_event(self, event: Dict, *, max_tokens: int = 1000) -> List[Dict]:
        """
        Envoie l'évènement complet et demande un diagnostic strict via tool calling.
        max_tokens est alloué à la réponse (outil) — la sortie reste structurée.
        """
        # Rappels et règles au LLM — orienté billetterie/évènementiel
        policy = Path("policy.md").read_text(encoding="utf-8")


        summary = self.summarize_event_keys(event, max_preview=40, max_lines=1500, max_depth=2, max_list_items=1)


        user_prompt = ( 
            "Analyse l'évènement complet en utilisant les règles."# Tu renverras UNIQUEMENT un appel de tool." 
            "Ne renvoie AUCUN texte libre. "
            "Résumé des clés :\n```\n"
            f"{summary}\n```" 
            "\n\nRéponds STRICTEMENT dans ce format :\n"
            "Exemple complet de réponse attendue :\n"
            "{\"issues\": [\n"
            "  {\n"
            "    \"rule_id\": \"RULE20\",\n"
            "    \"section\": \"PriceGroups\",\n"
            "    \"path\": \"PriceGroups\",\n"
            "    \"field\": \"PriceGroupModelList\",\n"
            "    \"severity\": \"error\",\n"
            "    \"message\": \"Aucun groupe de prix défini\",\n"
            "    \"expected\": \">=1 PriceGroup\",\n"
            "    \"found\": \"0\",\n"
            "    \"suggestion\": \"Créer un groupe de prix par section et canal\",\n"
            "    \"evidence\": \"PriceGroups: []\"\n"
            "  }\n"
            "   ... (plus d'issues si besoin) ...\n"
            "]}\n"
            )


        # --- Configuration du dossier logs (par event) ---
        log_dir = Path("logs"); log_dir.mkdir(exist_ok=True)
        event_id = event.get("Event", {}).get("Event", {}).get("ID", "unknown")
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        event_dir = log_dir / f"event_{event_id}"
        event_dir.mkdir(parents=True, exist_ok=True)

        # "base" référence désormais un préfixe daté DANS le dossier de l'event
        base = event_dir / ts

        # 1) prompt
        (base.with_suffix(".prompt.txt")).write_text(
            f"MODEL: {self.model}\nLEN(summary): {len(summary)} chars\n\n{summary}",
            encoding="utf-8"
        )



        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Tu es concis, rigoureux et orientes la correction de données."},
                {"role": "user", "content": policy},
                {"role": "user", "content": user_prompt},
            ],
            #tools=TOOLS_VALIDATOR,
            #tool_choice={"type":"function","function":{"name":"report_inconsistencies"}},
            temperature=0,
            max_tokens=max_tokens,
        )

        msg = resp.choices[0].message

        # Normalisation du content (str ou liste de segments)
        raw_content = getattr(msg, "content", "")
        if isinstance(raw_content, list):
            # Concatène les morceaux textuels si multipart
            try:
                raw_content = "".join(
                    seg.get("text", "") if isinstance(seg, dict) else str(seg)
                    for seg in raw_content
                )
            except Exception:
                raw_content = str(raw_content)

        filtered = {
            "id": getattr(resp, "id", None),
            "model": getattr(resp, "model", None),
            "usage": _jsonable(getattr(resp, "usage", None)),  # <= ici le fix
            "finish_reason": getattr(resp.choices[0], "finish_reason", None),
            "message": {
                "role": getattr(msg, "role", None),
                "content": raw_content,
                "tool_calls": _jsonable(getattr(msg, "tool_calls", None)),
            },
        }

        # --- Split sortie en 2 fichiers : meta (.response.json) + contenu (.content.txt) ---

        # 1) Prépare le texte du content (tentative de dé-échappage si le LLM a renvoyé
        #    un JSON "dans une string", p.ex. "{\n  \"issues\": [...]}").
        content_text = raw_content
        try:
            parsed = json.loads(raw_content)
            if isinstance(parsed, (dict, list)):
                # Le LLM a renvoyé un JSON sérialisé dans un string -> on pretty-print
                content_text = json.dumps(parsed, indent=2, ensure_ascii=False)
            elif isinstance(parsed, str):
                # C'était juste une string JSON-encodée -> on la récupère brute
                content_text = parsed
        except Exception:
            # Pas un JSON encodé -> on garde tel quel
            pass

        # 2) Métadonnées sans le "content"
        meta = {
            "id": getattr(resp, "id", None),
            "model": getattr(resp, "model", None),
            "usage": _jsonable(getattr(resp, "usage", None)),
            "finish_reason": getattr(resp.choices[0], "finish_reason", None),
            "message": {
                "role": getattr(msg, "role", None),
                # on retire le 'content' des métadonnées
                "tool_calls": _jsonable(getattr(msg, "tool_calls", None)),
            },
        }
        (base.with_suffix(".response.json")).write_text(
            json.dumps(meta, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )

        # 3) Contenu texte brut / pretty-JSON dans un .txt séparé
        (base.with_suffix(".content.txt")).write_text(
            content_text,
            encoding="utf-8"
        )



        if not getattr(msg, "tool_calls", None):
            return []

        try:
            args = json.loads(msg.tool_calls[0].function.arguments or "{}")
        except Exception:
            return []

        issues = args.get("issues", []) or []
        # Nettoyage léger des issues (trim/borne)
        out: List[Dict] = []
        for it in issues:
            if not isinstance(it, dict):
                continue
            path = str(it.get("path", "")).strip()
            field = str(it.get("field", "")).strip()
            severity = str(it.get("severity", "")).strip().lower()
            message = str(it.get("message", "")).strip()
            suggestion = (str(it.get("suggestion", "")).strip() or None)
            evidence = (str(it.get("evidence", "")).strip() or None)
            rule_id = (str(it.get("rule_id","")).strip() or "RULE??")
            section = (str(it.get("section","")).strip() or None)
            expected = (str(it.get("expected","")).strip() or None)
            found = (str(it.get("found","")).strip() or None)
            if severity not in {"error", "warning", "info"}:
                severity = "warning"
            if path and field and message:
                out.append({
                    "rule_id": rule_id,
                    "section": section,
                    "path": path,
                    "field": field,
                    "severity": severity,
                    "message": message,
                    **({"expected": expected} if expected else {}),
                    **({"found": found} if found else {}),
                    **({"suggestion": suggestion} if suggestion else {}),
                    **({"evidence": evidence} if evidence else {}),
                })

        # Enregistrement des issues détectées
        log_file = base.with_suffix(".debug.log")
        if out:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write("\n[DEBUG] Issues détectées :\n")
                json.dump(out, f, ensure_ascii=False, indent=2)
        else:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write("\n✅ Aucune incohérence détectée.\n")

        return out


