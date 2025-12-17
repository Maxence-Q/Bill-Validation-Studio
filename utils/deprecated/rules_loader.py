# Utils/rules_loader.py
from __future__ import annotations
from typing import Any, Dict, List, Tuple, Iterable

VALID_MODULES = {
    "temporalite", "plan_capacite", "tarifs_client", "pos_frais",
    "internet", "forfaits_produits", "ids_tags", "final_validation",
}

def _iter_paths_from_group(g: Dict[str, Any]) -> Iterable[str]:
    """
    Récupère les chemins depuis un group, en supportant plusieurs clés:
    - include_paths  (ton cas)
    - fields / paths (fallback)
    Accepte liste, dict (aplati les valeurs), ou str (split ligne).
    """
    # priorité à include_paths si présent
    raw = (
        g.get("include_paths", None)
        if "include_paths" in g else
        g.get("fields", None) if "fields" in g else
        g.get("paths", None)
    )

    if raw is None:
        return []

    if isinstance(raw, list):
        for p in raw:
            if isinstance(p, str):
                p = p.strip()
                if p:
                    yield p
        return

    if isinstance(raw, dict):
        # aplatir toutes les listes/valeurs du dict
        for _, v in raw.items():
            if isinstance(v, list):
                for p in v:
                    if isinstance(p, str):
                        p = p.strip()
                        if p:
                            yield p
            elif isinstance(v, str):
                s = v.strip()
                if s:
                    yield s
        return

    if isinstance(raw, str):
        # autorise un chemin unique dans une string
        s = raw.strip()
        if s:
            # split rudimentaire (si jamais l’auteur a mis des retours à la ligne)
            for p in s.replace(",", "\n").splitlines():
                p = p.strip()
                if p:
                    yield p
        return

    # autre type: ignore
    return []


def collect_for_module(rules_mapping: Dict[str, Any], module_id: str) -> Tuple[List[str], List[str], List[Dict[str, Any]]]:
    if module_id not in VALID_MODULES:
        raise ValueError(f"Module inconnu: {module_id}")

    rules_block  = rules_mapping.get("rules", {})  or {}
    groups_block = rules_mapping.get("groups", []) or []

    # 1) Règles de CE module
    rule_ids = [
        rid for rid, rmeta in rules_block.items()
        if isinstance(rmeta, dict) and rmeta.get("module") == module_id
    ]

    # 2) Groupes de CE module
    groups_for_module = [
        g for g in groups_block
        if isinstance(g, dict) and g.get("module") == module_id
    ]

    # 3) Paths agrégés depuis les groupes (supporte include_paths / fields / paths)
    field_paths: List[str] = []
    seen = set()
    for g in groups_for_module:
        for p in _iter_paths_from_group(g):
            if p not in seen:
                seen.add(p)
                field_paths.append(p)

    return rule_ids, field_paths, groups_for_module
