"""
Minimal LLM module for final validation (no tools yet).
- Class name: FinalLLMValidator

Usage
-----
from LLM.llm_final_module import FinalLLMValidator
mod = FinalLLMValidator(model="llama-3.1-8b-instant")

"""
from __future__ import annotations
from typing import Any, Dict, Optional, List
import os
import json, textwrap

# External client configured exactly like in llm_final_validator (__init__ parity)
from openai import OpenAI

# langsmith
from langsmith.wrappers import wrap_openai

from utils.data_extractor import _get_paths, build_llm_summary
from utils.utils import get_ts_api_by_url

from LLM.tools import *


class FinalLLMValidator:
    def __init__(self, model: str = "llama-3.1-8b-instant"):
        """Init kept identical in spirit to llm_final_validator.__init__ (Groq-compatible OpenAI client).
        - If GROQ_API_KEY is set, use Groq's OpenAI-compatible endpoint.
        - Store chosen model name.
        """
        self.client = wrap_openai(OpenAI(
            api_key=os.environ.get("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
        ))
        self.model = model

        self.current_ctx: Dict[str, Any] = {}

        self.history_ctx: Optional[Dict[str, Any]] = None 

        self.business_data: Dict[str, Dict[str, Dict[str, Any]]] = {}

        self.policy: str | None = None

        self.user_prompt: Optional[str] = None

    def set_current_context(
        self,
        *,
        module_id: str,
        event_full: Dict[str, Any],
        rule_ids: List[str],
        field_paths: List[str],
        event_id: Optional[int] = None,
        source: str = "get_ts_api",
        take_first_in_lists: bool = True,   # petit confort : aplatir si liste
    ) -> Dict[str, Any]:
        """Construit et stocke self.current_ctx à partir des chemins et règles ciblées."""
        fields: Dict[str, Any] = {}
        for p in field_paths:
            vals = _get_paths(event_full, p)  # gère 'A.B[].C' etc.  :contentReference[oaicite:3]{index=3}
            if take_first_in_lists and isinstance(vals, list):
                fields[p] = (vals[0] if vals else None)
            else:
                fields[p] = vals

        self.current_ctx = {
            "module_id": module_id,
            "rules": list(rule_ids),
            "fields": fields,
            "meta": {"event_id": event_id, "source": source},
        }
        return self.current_ctx

    def set_history_context(self, history: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stocke l'historique (construit à partir des 4 évènements similaires) pour ce module.
        """
        self.history_ctx = history or {}
        return self.history_ctx

    def set_business_data(
        self,
        *,
        module_id: str,
        routes: List[Dict[str, str]],
        timeout: int = 20,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Consomme la liste `routes` (issue de collect_routes_for_module) et
        récupère les JSON distants pour alimenter la "business data" de ce module.

        - On ne traite que les méthodes GET pour l’instant.
        - En cas d'erreur HTTP/JSON, on stocke un champ 'error' au lieu de lever.
        - Retourne la sous-structure du module (et met à jour self.business_data[module_id]).
        """
        module_store: Dict[str, Dict[str, Any]] = {}

        for r in routes or []:
            name  = (r.get("name") or "").strip() or "unnamed"
            method = (r.get("method") or "GET").upper().strip()
            url    = (r.get("url") or "").strip()
            if not url:
                # URL vide -> ignore
                continue

            # Appel API générique
            data = get_ts_api_by_url(url, timeout=timeout)
            module_store[name] = {"url": url, "method": method, "data": data}

        # Mémorise et renvoie la vue du module
        self.business_data[module_id] = module_store
        return module_store
    
    def attach_llm_summary(
        self,
        *,
        event_full: Dict[str, Any],
        rules_map: Dict[str, Any],
        groups: Optional[List[str]] = None,
        truncate: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Fabrique un résumé structuré (par groupes) pour le prompt LLM."""
        summary = build_llm_summary(  # :contentReference[oaicite:4]{index=4}
            event_full,
            rules_map,
            groups=groups,
            truncate=truncate,
        )
        self.current_ctx.setdefault("summary", summary)
        return summary

    def set_policy(self, policy: str) -> None:
        """Définit la policy textuelle (preamble) à passer au LLM pour CE module."""
        self.policy = (policy or "").strip() or None

    def set_user_prompt(self, contributions: Dict[int,str], module_id:str) -> str:
        """
        Construit le user prompt pour un module donné à partir des contributions
        (1 événement cible + 4 événements similaires).
        - contributions : {event_id: "bloc de lignes path: value\n..."}
        """

        if not contributions:
            raise ValueError("contributions is empty in set_user_prompt")

        # On suppose que le dict a été rempli dans l'ordre :
        #   d'abord l'événement cible, puis les 4 similaires.
        target_event_id = next(iter(contributions.keys()))
        current_block = contributions[target_event_id]

        similar_parts = []
        for eid, block in contributions.items():
            if eid == target_event_id:
                continue
            similar_parts.append(f"Event ID: {eid}\n{block}")

        similar_block = "\n\n".join(similar_parts) if similar_parts else "Aucun événement similaire fourni."

        prompt = textwrap.dedent(f"""
Analyse la section d’événement pour le module **{module_id}**.

Rappels importants :
- Tu dois appliquer strictement la policy du module "{module_id}" qui t'est fournie séparément.
- Tu dois toujours appeler la fonction format_issues.
- Si aucune anomalie n'est détectée pour ce module, tu dois renvoyer status="ok" et issues=[].
- Tu dois utiliser les événements similaires comme références de comparaison.
- Tu dois uniquement corriger l'événement cible, pas les similaires.

        Événement CIBLE (Event ID {target_event_id}) :
        ```
        {current_block}
        ```

        Événements SIMILAIRES (références) :
        ```
        {similar_block}
        ```
        """.strip()
        + """
FORMAT DE SORTIE
- Tu dois répondre STRICTEMENT en JSON, SANS TEXTE ADDITIONNEL.
- La sortie doit être un objet JSON avec deux clés :
- "status": chaîne de caractères,
- "issues": liste (array) d’objets, chaque objet représentant une issue détectée.

Format attendu :
{
"status": "<valeur>",
"issues": [
    {
    "message": "<explication courte et claire de l'anomalie détectée>",
    "path": "<identifiant permettant de localiser le POS ou l’élément problématique pour l'événement CIBLE>",
    "severity": "<error|warning|info>",
    "suggestion": "<proposition concrète de correction ou d'action pour l'opérateur>"
    }
]
}

        """).strip()

        self.user_prompt = prompt
        return prompt
    
    def validate_section(self) -> str:
        """
        Appelle le LLM pour valider la section courante du module.
        - Utilise self.policy (préambule) et self.user_prompt (invite).
        - Retourne UNIQUEMENT une chaîne.
        * Si tool_call 'report_inconsistencies' -> retourne le JSON 'issues' en string.
        * Sinon -> retourne le texte de l'assistant.
        En cas d'erreur, retourne une chaîne 'ERROR: ...'.
        """

        # Fallbacks si rien n'a été fixé avant l'appel
        policy = (self.policy or "").strip()

        # user_prompt doit être renseigné via set_user_prompt(module_id=...)
        user_prompt = (getattr(self, "user_prompt", None) or "").strip()

        # Messages à envoyer
        messages = [
            {"role": "system", "content": "Tu es concis, rigoureux et orientes la correction de données."},
            {"role": "user", "content": policy},
            {"role": "user", "content": user_prompt},
        ]

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0,
            tools=TOOLS,
            tool_choice={"type": "function", "function": {"name": "format_issues"}},
        )

        choice = resp.choices[0]
        tc = choice.message.tool_calls[0]  # type: ignore
        return json.dumps(json.loads(tc.function.arguments), ensure_ascii=False, indent=2) # type: ignore


    
# Example usage
if __name__ == "__main__":
    mod = FinalLLMValidator(model="llama-3.1-8b-instant")
