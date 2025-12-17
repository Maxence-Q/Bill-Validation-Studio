# utils/render_str.py
from __future__ import annotations
from typing import Any, Dict, Iterable, List, Optional
import json

def _val_to_str(v: Any) -> str:
    """Serialize any value to a compact, single-line string."""
    try:
        s = json.dumps(v, ensure_ascii=False)
    except Exception:
        s = str(v)
    # force single-line
    return " ".join(s.splitlines())

def render_current_ctx(current_ctx: Optional[Dict[str, Any]]) -> str:
    """
    Render only the fields of the current context as lines:
      <path>: <value>
    If missing/invalid, returns a helpful placeholder.
    """
    if not isinstance(current_ctx, dict):
        return "(contexte courant indisponible)"
    fields = current_ctx.get("fields")
    if not isinstance(fields, dict) or not fields:
        return "(aucun champ dans le contexte courant)"
    lines: List[str] = []
    for path in sorted(fields.keys()):
        lines.append(f"{path}: {_val_to_str(fields[path])}")
    return "\n".join(lines)

def render_history_ctx(history_ctx: Optional[Dict[str, Any]]) -> str:
    """
    Render only the fields of the 4 similar events.
    Format:
      — Événement <id>
      <path1>: <value>
      <path2>: <value>
      ...
    If missing/invalid, returns a helpful placeholder.
    """
    if not isinstance(history_ctx, dict) or not history_ctx:
        return "(historique indisponible)"
    fields: List[str] = []
    # Prefer explicit 'fields' list; else infer from first similar item
    if isinstance(history_ctx.get("fields"), list):
        fields = [str(p) for p in (history_ctx.get("fields") or []) if isinstance(p, (str, int))]
    if not fields:
        sim = history_ctx.get("similar_events")
        if isinstance(sim, list) and sim:
            first = sim[0]
            fdict = (first or {}).get("fields", {})
            if isinstance(fdict, dict):
                fields = list(fdict.keys())
    similar = history_ctx.get("similar_events") or []
    if not isinstance(similar, list) or not similar:
        return "(aucun événement similaire à afficher)"
    # Build output
    chunks: List[str] = []
    for row in similar:
        if not isinstance(row, dict):
            continue
        eid = row.get("id", "?")
        fdict = row.get("fields", {}) if isinstance(row.get("fields"), dict) else {}
        chunks.append(f"— Événement {eid}")
        # render fields in the order defined by 'fields' (if present), else iterate dict keys
        keys = fields or list(fdict.keys())
        for p in keys:
            chunks.append(f"{p}: {_val_to_str(fdict.get(p))}")
        # separator line
        chunks.append("")
    return "\n".join(chunks).rstrip()
