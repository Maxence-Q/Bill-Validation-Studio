# Utils/history_loader.py
from __future__ import annotations
from typing import Any, Dict, Iterable, List, Tuple, Optional
from collections import Counter

# We reuse the JSON path resolver already introduced
from utils.data_extractor import _get_paths


def _normalize_field_paths(current_ctx: Dict[str, Any]) -> List[str]:
    """
    Extracts field paths from current_ctx["fields"] keys.
    Example keys:
      "Event.Event.IsInSale"
      "Event.Event.EventDates[0].Date"
    """
    fields = (current_ctx or {}).get("fields") or {}
    if not isinstance(fields, dict):
        return []
    return [str(k) for k in fields.keys()]


def extract_fields_snapshot(full_config: Dict[str, Any], field_paths: Iterable[str],take_first_in_lists: bool = True) -> Dict[str, Any]:
    """
    For one full_config, return a { path: value } snapshot for the given field_paths.
    Missing values are included with value=None to keep alignment across rows.
    """
    snap: Dict[str, Any] = {}
    for p in field_paths:
        vals = _get_paths(full_config, p)  # gère 'A.B[].C'
        if take_first_in_lists and isinstance(vals, list):
            snap[p] = (vals[0] if vals else None)
        else:
            # si _get_paths renvoie [], on met None pour garder l’alignement
            snap[p] = vals if vals != [] else None
    return snap


def build_history_for_module(
    similar_full: Dict[int, Dict[str, Any]],
    current_ctx: Dict[str, Any],
    extra_paths: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """
    Build a compact 'history' structure aligned with the current module context.
    Inputs:
      - similar_full: { similar_event_id: full_config_dict, ... }
      - current_ctx: a dict containing at least a "fields" dict with JSON paths
      - extra_paths: optional extra JSON paths to include
    Output format:
      {
        "fields": [<path1>, <path2>, ...],
        "similar_events": [
            {"id": 123, "fields": {<path>: <value>, ...}},
            ...
        ],
        "stats": {
            <path>: {"most_common": <val>, "distinct": <n>, "counts": [[val, n], ... up to 5]}
        }
      }
    """
    # Collect paths of interest
    paths = list(_normalize_field_paths(current_ctx))
    if extra_paths:
        for p in extra_paths:
            sp = str(p)
            if sp not in paths:
                paths.append(sp)

    # Build rows
    rows: List[Tuple[int, Dict[str, Any]]] = []
    for eid, full in (similar_full or {}).items():
        if not isinstance(full, dict):
            continue
        snap = extract_fields_snapshot(full, paths)
        rows.append((eid, snap))

    # Aggregate small stats per field to help the LLM
    stats: Dict[str, Any] = {}
    for p in paths:
        cnt = Counter()
        for _, snap in rows:
            cnt.update([repr(snap.get(p))])  # repr to make dict keys hashable for unhashables
        most_common_val, most_common_cnt = (None, 0)
        try:
            (most_common_val, most_common_cnt) = next(iter(cnt.most_common(1)))
        except StopIteration:
            pass
        stats[p] = {
            "most_common": most_common_val,
            "distinct": len(cnt),
            "counts": cnt.most_common(5),
        }

    return {
        "fields": paths,
        "similar_events": [{"id": eid, "fields": snap} for eid, snap in rows],
        "stats": stats,
    }
