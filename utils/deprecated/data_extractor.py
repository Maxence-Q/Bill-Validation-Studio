import json, datetime
from typing import Any, Iterable
from copy import deepcopy

def _get_paths(d: dict, dotted_path: str) -> list[Any]:
    """Retourne une liste de valeurs pour un chemin type 'A.B[].C'.
    Si '[]' est présent, itère. Si le chemin n'existe pas, retourne [].
    """
    segs = dotted_path.split(".")
    curr = [d]
    for seg in segs:
        is_list = seg.endswith("[]")
        key = seg[:-2] if is_list else seg
        nxt = []
        for node in curr:
            if not isinstance(node, dict) or key not in node:
                continue
            val = node[key]
            if is_list and isinstance(val, list):
                nxt.extend(val)
            elif not is_list:
                nxt.append(val)
        curr = nxt
    return curr

def _maybe_trunc(v: Any, n: int, redact_html: bool):
    if isinstance(v, str):
        s = v
        if redact_html:
            # très simple garde-fou : retire balises basiques
            s = s.replace("<p>", "").replace("</p>", "").replace("<br>", " ")
        return s if len(s) <= n else s[:n] + "…"
    return v

def build_llm_summary(event_full: dict, rules_map: dict, *,
                      groups: Iterable[str] | None = None,
                      truncate: int | None = None) -> dict:
    """Construit un summary minimal par groupe pour le user_prompt."""
    cfg = rules_map.get("defaults", {})
    max_list_items = int(cfg.get("max_list_items", 5))
    redact_html = bool(cfg.get("redact_html_fields", True))
    truncate_text_at = int(cfg.get("truncate_text_at", 300))
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    selected_groups = [g for g in rules_map["groups"]
                       if (groups is None or g["id"] in groups)]

    out = {
        "_meta": {
            "now_utc": now_iso,
            "tz_hint": _get_paths(event_full, "Timezone.TZDatabaseID")[:1] or None,
        },
        "groups": {}
    }

    for g in selected_groups:
        gsum = {"include": {}, "computed": {}}

        # include_paths
        for path in g.get("include_paths", []):
            vals = _get_paths(event_full, path)
            if isinstance(vals, list):
                vals = vals[:max_list_items]
                vals = [_maybe_trunc(v, truncate_text_at, redact_html) for v in vals]
            gsum["include"][path] = vals

        # computed (placeholders simples)
        for comp in g.get("computed", []):
            name = comp["name"]
            kind = comp["kind"]
            res = {"kind": kind, "status": "todo", "inputs": comp.get("inputs", {})}
            # NB: tu implémenteras les vrais calculs côté validateur.
            # Ici on pose une empreinte légère, utile au LLM pour raisonner.
            if kind == "fr_en_required_when_display":
                flag = _get_paths(event_full, comp["inputs"]["flag_path"])
                res["preview"] = {"display": flag[:1]}
            elif kind == "temporal_check":
                res["preview"] = {
                    "date_count": len(_get_paths(event_full, comp["inputs"]["date_path"])),
                    "tz": (_get_paths(event_full, comp["inputs"]["tz_path"])[:1] or [None])[0],
                }
            elif kind == "pos_required":
                res["preview"] = {"required": comp["inputs"].get("required", [])}
            gsum["computed"][name] = res

        # compare_to_similar (clé de jointure)
        cts = g.get("compare_to_similar", {})
        if cts:
            sample_keys = {k: (_get_paths(event_full, k)[:1] or [None])[0] for k in cts.get("keys", [])}
            gsum["compare_to_similar"] = {"keys": sample_keys, "metrics": cts.get("metrics", [])}

        out["groups"][g["id"]] = gsum

    if truncate:
        # optionnel : tronquer le JSON sérialisé pour un prompt très court
        s = json.dumps(out, ensure_ascii=False)
        s = s[:truncate] + "…"
        return {"_truncated": True, "preview": s}
    return out
