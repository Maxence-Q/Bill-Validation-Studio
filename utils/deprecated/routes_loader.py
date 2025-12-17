# Utils/routes_loader.py
from __future__ import annotations
from typing import Any, Optional, Dict, List
import re
import yaml
from pathlib import Path

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z0-9_]+)\}")

def load_routes_completion(path: str | Path = "artefacts/routes_completion.yaml") -> dict[str, dict[str, str]]:
    """
    Charge artefacts/routes_completion.yaml et renvoie un mapping:
      { name: { 'url': '...', 'path': 'Event.IDChain.OwnerPOSID' }, ... }
    """
    p = Path(path)
    if not p.exists():
        return {}
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    # normalise en dict[str, dict]
    out: dict[str, dict[str, str]] = {}
    for k, v in (data.items() if isinstance(data, dict) else []):
        if isinstance(v, dict) and "url" in v:
            out[str(k)] = {"url": str(v.get("url", "") or ""), "path": str(v.get("path", "") or "")}
    return out

def complete_route(name: str, routes_completion: dict[str, dict[str, str]] | None = None
                   ) -> Optional[str]:
    """
    Retourne le 'path' associé à un 'name' depuis routes_completion.yaml,
    ou None si non trouvé (dans ce cas l'URL sera ignorée si elle a des placeholders).
    """
    if not routes_completion:
        routes_completion = load_routes_completion()
    info = routes_completion.get(name)
    if not info:
        return None
    path = (info.get("path") or "").strip()
    return path or None

def get_value_by_path(path: str, data: Any) -> Any:
    """
    Résout un chemin type 'Event.IDChain.OwnerPOSID' dans un dict/list Python.
    - Supporte index de liste: 'Event.EventDates[0].Id' ou 'Prices[2]'
    - Renvoie None si introuvable.
    """
    if not path:
        return None
    cur = data
    tokens = path.split(".")
    for tok in tokens:
        # gestion index de liste : key[idx]
        m = re.match(r"^([A-Za-z0-9_]+)(\[(\d+)\])?$", tok)
        if not m:
            return None
        key = m.group(1)
        idx = m.group(3)
        if isinstance(cur, dict):
            if key not in cur:
                return None
            cur = cur[key]
        else:
            return None
        if idx is not None:
            if not isinstance(cur, list):
                return None
            i = int(idx)
            if i < 0 or i >= len(cur):
                return None
            cur = cur[i]
    return cur

def find_placeholders(url_tmpl: str) -> list[str]:
    """
    Liste les placeholders {token} présents dans l'URL (hors base_url que l’on gère séparément).
    """
    return [m.group(1) for m in _PLACEHOLDER_RE.finditer(url_tmpl) if m.group(1) != "base_url"]

def render_url(url_tmpl: str, *, base_url: str, values: dict[str, Any]) -> Optional[str]:
    """
    Remplace {base_url} + autres placeholders par 'values'.
    Renvoie None si une valeur obligatoire manque.
    """
    if not url_tmpl:
        return None
    url = url_tmpl.replace("{base_url}", base_url or "")
    for ph in find_placeholders(url_tmpl):
        if ph not in values or values[ph] in (None, ""):
            return None
        url = url.replace("{%s}" % ph, str(values[ph]))
    return url


def collect_routes_for_module(
    modules_routes: Dict[str, Any],
    module_id: str,
    *,
    event_full_config: Dict[str, Any],
    routes_completion_path: str = "artefacts/routes_completion.yaml",
) -> List[Dict[str, str]]:
    """
    Extrait, pour un module, les routes 'obligatoires' (optional != true).
    Si l'URL comporte des placeholders additionnels (ex: {posId}),
    on tente de les compléter à partir:
      - de routes_completion.yaml (name -> path)
      - de la full config (résolution du path)
    Si on ne parvient pas à compléter => on IGNORE cette route.
    Renvoie une liste: {name, method, url} avec l'URL rendue.
    """
    if not isinstance(modules_routes, dict):
        raise ValueError("modules_routes doit être un dict (yaml.safe_load).")
    if not isinstance(event_full_config, dict):
        raise ValueError("event_full_config doit être un dict (full config de l'évènement).")

    base_url = modules_routes.get("base_url", "") or ""
    mods = modules_routes.get("modules", {}) or {}
    spec = mods.get(module_id) or {}
    routes = spec.get("routes", []) or []

    routes_completion = load_routes_completion(routes_completion_path)

    out: List[Dict[str, str]] = []
    for r in routes:
        if not isinstance(r, dict):
            continue
        if r.get("optional", False) is True:
            continue  # on ne prend PAS les routes optionnelles pour l’instant

        name = str(r.get("name", "") or "").strip() or "unnamed"
        method = str(r.get("method", "GET") or "GET").upper().strip()
        url_tmpl = str(r.get("url", "") or "").strip()
        if not url_tmpl:
            continue

        # Détecter placeholders (hors base_url)
        placeholders = find_placeholders(url_tmpl)

        # Cas simple: aucun placeholder supplémentaire => on rend direct
        if not placeholders:
            final_url = render_url(url_tmpl, base_url=base_url, values={})
            if final_url:
                out.append({"name": name, "method": method, "url": final_url})
            continue

        # Sinon, on demande à routes_completion s’il y a un 'path' pour ce 'name'
        path = complete_route(name, routes_completion)
        if not path:
            # pas de règle de complétion pour ce name -> on ignore cette route
            continue

        # On tente d’extraire la valeur depuis la full config
        value = get_value_by_path(path, event_full_config)

        # On mappe la valeur au placeholder attendu.
        # Hypothèse simple: un seul placeholder (ex.: {posId}). Si plusieurs, on pourra étendre.
        values_map: Dict[str, Any] = {}
        if len(placeholders) == 1:
            values_map[placeholders[0]] = value
        else:
            # Support minimal multi-placeholders: si path retourne dict, on pique les clés
            if isinstance(value, dict):
                for ph in placeholders:
                    if ph in value:
                        values_map[ph] = value[ph]
            # Si on ne couvre pas tous les placeholders, on ignore
            if any(ph not in values_map or values_map[ph] in (None, "") for ph in placeholders):
                continue

        final_url = render_url(url_tmpl, base_url=base_url, values=values_map)
        if final_url:
            out.append({"name": name, "method": method, "url": final_url})

    return out
