# utils/similar_events_extractor.py
"""
Utilities to find the K most similar events based on lightweight text features
found in storage/all_events.json. Uses only stdlib; similarity = Jaccard on token sets.

Public API:
    find_similar_event_ids(target_id: int, *, k: int = 4,
                           all_events_path: str = "storage/all_events.json") -> list[int]

Notes:
- We compare a compact textual signature built from several keys (NameFr, NameEn,
  InternetName_Fr, InternetName_En, ArtistName, ProducerName if present).
- Ties are broken by (higher similarity first) then by smaller absolute ID diff,
  then by ID ascending.
- The target_id itself is excluded from results.
"""
from __future__ import annotations
import json
import os
import re
from typing import Any, Dict, List, Set, Tuple

TEXT_KEYS = [
    "NameFr",
    "NameEn",
    "InternetName_Fr",
    "InternetName_En",
    "ArtistName",
    "ProducerName",
]

_TOKEN_RE = re.compile(r"[\w\-']+", re.UNICODE)


def _load_all_events(path: str) -> List[Dict[str, Any]]:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"all_events.json introuvable: {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("all_events.json doit contenir une liste d'objets")
    return data


def _by_id(events: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    out: Dict[int, Dict[str, Any]] = {}
    for e in events:
        try:
            eid = int(e["ID"])  # type: ignore[index]
        except Exception:
            continue
        out[eid] = e
    return out


def _signature_tokens(e: Dict[str, Any]) -> Set[str]:
    parts: List[str] = []
    for k in TEXT_KEYS:
        v = e.get(k)
        if isinstance(v, str) and v.strip():
            parts.append(v)
    if not parts:
        return set()
    text = " ".join(parts).lower()
    return set(_TOKEN_RE.findall(text))


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = a & b
    union = a | b
    if not union:
        return 0.0
    return len(inter) / len(union)


def find_similar_event_ids(
    target_id: int,
    *,
    k: int = 4,
    all_events_path: str = "storage/all_events.json",
) -> List[int]:
    """
    Return the top-k most similar event IDs, excluding the target itself.
    Similarity is Jaccard between token sets extracted from TEXT_KEYS.
    """
    events = _load_all_events(all_events_path)
    byid = _by_id(events)

    if target_id not in byid:
        raise KeyError(f"ID {target_id} introuvable dans {all_events_path}")

    target_tokens = _signature_tokens(byid[target_id])

    # Sort key: higher sim first -> negative for ascending sort,
    # then by absolute ID distance to stabilize, then by ID ascending.
    scored: List[Tuple[float, int, int]] = []
    for eid, e in byid.items():
        if eid == target_id:
            continue
        s = _jaccard(target_tokens, _signature_tokens(e))
        scored.append((-s, abs(eid - target_id), eid))

    scored.sort()
    return [eid for (_neg, _dist, eid) in scored[:k]]
