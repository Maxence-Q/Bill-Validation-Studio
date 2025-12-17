import json
import requests
from typing import Any, Dict, List, Tuple, Optional
import yaml
import os

BILL_TS_API_URL=os.getenv("BILL_TS_API_URL", "")
BILL_TS_API_KEY=os.getenv("BILL_TS_API_KEY")

def _jsonable(obj):
    """Convertit les objets OpenAIObject/Pydantic en dict JSON-sérialisable."""
    if obj is None:
        return None
    # OpenAI SDK récent (pydantic)
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump()
        except Exception:
            pass
    # OpenAIObject (versions diverses)
    if hasattr(obj, "to_dict_recursive"):
        try:
            return obj.to_dict_recursive()
        except Exception:
            pass
    # Tentative: si str(obj) est du JSON
    try:
        return json.loads(str(obj))
    except Exception:
        return str(obj)


# ---------- chargement IDs ----------
def load_all_ids(path: str = "storage/all_events.json") -> List[int]:
    with open(path, "r", encoding="utf-8") as f:
        events = json.load(f)
    return [e["ID"] for e in events]

# ---------- API ----------
def get_ts_api(event_id: int) -> Dict[str, Any]:
    path = f"bill/events/{event_id}/fullconfig"
    url = f"{BILL_TS_API_URL.rstrip('/')}/{path.lstrip('/')}"
    headers = {'rese566': BILL_TS_API_KEY}
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    return r.json()

def http_get_json(url: str, *, headers: Optional[Dict[str, str]] = None, timeout: int = 20) -> Any:
    """
    Effectue un GET HTTP sur `url` et renvoie r.json().
    Lève requests.HTTPError en cas d'échec (status >= 400).
    """
    r = requests.get(url, headers=headers or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()

def get_ts_api_by_url(url: str, *, timeout: int = 20) -> Any:
    """
    Version généralisée de get_ts_api(...) :
    - Prend un URL complet (déjà rendu dans collect_routes_for_module).
    - Si la variable d'environnement BILL_TS_API_KEY est présente, on l'ajoute
      dans l'entête 'rese566' (même convention que ta fonction d'origine).
    - Tente un GET JSON et renvoie la réponse parsée.
    """
    api_key = BILL_TS_API_KEY
    headers = {"rese566": api_key} if api_key else {}
    return http_get_json(url, headers=headers, timeout=timeout)
