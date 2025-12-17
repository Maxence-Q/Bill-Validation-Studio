# event_brief.py
from __future__ import annotations
import argparse
import json
import os
import random
import traceback
from typing import Any, Dict, List, Optional

import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
import yaml  # pip install pyyaml

# ---- Imports projet
try:
    from data_factory import DataFactory  # doit fournir: get_full_config, get_similar_events,
                                          # modules_initializer, build_contexts_for_all_modules,
                                          # execution_order, attach_business_data_to_all_modules,
                                          # attach_module_policy, attach_module_user_prompt, call_llm
except Exception as e:
    print("ERROR: Unable to import DataFactory from data_factory.py.")
    traceback.print_exception(type(e), e, e.__traceback__)
    raise SystemExit(2)

# === Config ===
ALL_EVENTS_PATH = "storage/all_events.json"

ESSENTIAL_KEYS: List[str] = [
    "ID",
    "NameFr",
    "NameEn",
    "InternetName_Fr",
    "InternetName_En",
    "ArtistName",
    "DisplayOnTheInternet",
    "IsInSale",
    "IsGeneralAdmission",
    "HasNoSpecificDate",
    "TicketLimitNumber",
    "RepresentationTypeId",
    "VenueModelId",
    "ProducerID",
    "ActivityTypeID",
    "SupportETicketShipping",
    "SupportMailShipping",
]


# ---------- Helpers: data ----------
def pick_event_id(explicit_id: Optional[int]) -> int:
    """Return an event ID either from --id or by sampling from storage/all_events.json."""
    if explicit_id is not None:
        return explicit_id
    if not os.path.isfile(ALL_EVENTS_PATH):
        raise FileNotFoundError(f"IDs file not found: {ALL_EVENTS_PATH}")
    with open(ALL_EVENTS_PATH, "r", encoding="utf-8") as f:
        events = json.load(f)
    pool = [e["ID"] for e in events if isinstance(e, dict) and "ID" in e]
    if not pool:
        raise RuntimeError(f"No IDs found in {ALL_EVENTS_PATH}")
    return random.choice(pool)


def extract_core_from_full(event_full: Dict[str, Any]) -> Dict[str, Any]:
    """Safely get Event.Event dict from a fullconfig-like payload."""
    try:
        return dict(event_full["Event"]["Event"])  # type: ignore[index]
    except Exception:
        return {}


def load_all_events_index() -> Dict[int, Dict[str, Any]]:
    """Index (id -> summary) from storage/all_events.json for compact cards."""
    if not os.path.isfile(ALL_EVENTS_PATH):
        return {}
    with open(ALL_EVENTS_PATH, "r", encoding="utf-8") as f:
        events = json.load(f)
    out: Dict[int, Dict[str, Any]] = {}
    for e in events:
        try:
            eid = int(e["ID"])  # type: ignore[index]
        except Exception:
            continue
        out[eid] = e
    return out


# ---------- UI pieces ----------
def copy_to_clipboard(text: str, root: tk.Tk) -> None:
    root.clipboard_clear()
    root.clipboard_append(text)
    root.update()


def build_similar_cards(container: ttk.Frame, ids: List[int]) -> None:
    """Create a 4-column layout with compact summaries for each similar event."""
    index = load_all_events_index()
    # Clean previous content
    for child in container.winfo_children():
        child.destroy()

    grid = ttk.Frame(container)
    grid.pack(fill=tk.BOTH, expand=True)

    # choose which keys to show in the compact cards
    card_keys = [
        "ID",
        "NameFr",
        "ArtistName",
        "DisplayOnTheInternet",
        "IsInSale",
    ]

    for col, eid in enumerate(ids[:4]):
        card = ttk.Frame(grid, padding=(8, 8))
        card.grid(row=0, column=col, sticky="nsew")

        ev = index.get(eid, {"ID": eid})
        title = f"ID {eid}"
        hdr = ttk.Label(card, text=title)
        hdr.configure(font=("Segoe UI", 12, "bold"))
        hdr.pack(anchor="w", pady=(0, 6))

        columns = ("key", "value")
        tree = ttk.Treeview(card, columns=columns, show="headings", height=10)
        tree.heading("key", text="Champ")
        tree.heading("value", text="Valeur")
        tree.column("key", width=140, anchor="w")
        tree.column("value", width=220, anchor="w")
        yscroll = ttk.Scrollbar(card, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=yscroll.set)

        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        yscroll.pack(side=tk.RIGHT, fill=tk.Y)

        for k in card_keys:
            if k in ev:
                v = ev.get(k)
                if isinstance(v, bool):
                    v = "Oui" if v else "Non"
                tree.insert("", tk.END, values=(k, v))

        grid.columnconfigure(col, weight=1)
    grid.rowconfigure(0, weight=1)


def build_window(
    title: str,
    core: Dict[str, Any],
    nl_summary: str,
    on_first_click_get_similar_ids,
    on_second_click_build_contexts,
    on_third_click_attach_business_data,
    on_fourth_click_attach_policies,
    on_fifth_click_attach_user_prompts,
    on_sixth_click_call_llm,
) -> None:
    """
    Window:
      - Header + main table of core fields
      - 1st Suite click: show 4 similar events row
      - 2nd Suite click: show modules slider (◀ ▶) for contexts
      - 3rd Suite click: show modules slider (◀ ▶) for business rules/data
      - 4th Suite click: show modules slider (◀ ▶) for consignes (policies) par module
      - 5th Suite click: show modules slider (◀ ▶) pour les 'prompts utilisateur' par module
      - 6th Suite click: show modules slider (◀ ▶) pour les réponses LLM par module
    """
    root = tk.Tk()
    root.title(title)

    # === Fullscreen on launch (F11 toggle, ESC leave fullscreen) ===
    def _toggle_fullscreen():
        cur = root.attributes("-fullscreen")
        root.attributes("-fullscreen", not cur)

    try:
        root.attributes("-fullscreen", True)
    except Exception:
        try:
            root.state("zoomed")
        except Exception:
            pass

    root.bind("<F11>", lambda e: _toggle_fullscreen())
    root.bind("<Escape>", lambda e: root.attributes("-fullscreen", False))

    # Theme & style
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except Exception:
        pass
    style.configure("Header.TLabel", font=("Segoe UI", 14, "bold"))
    style.configure("TButton", padding=(10, 6))
    style.configure("Treeview", rowheight=26)

    # === Header ===
    header = ttk.Frame(root, padding=(12, 12, 12, 0))
    header.pack(fill=tk.X)
    ttk.Label(header, text=title, style="Header.TLabel").pack(anchor="w")

    # === Main table (key/value) ===
    table_wrap = ttk.Frame(root, padding=(12, 8))
    table_wrap.pack(fill=tk.BOTH, expand=True)

    columns = ("key", "value")
    tree = ttk.Treeview(table_wrap, columns=columns, show="headings")
    tree.heading("key", text="Champ")
    tree.heading("value", text="Valeur")
    tree.column("key", width=300, anchor="w")
    tree.column("value", width=760, anchor="w")

    yscroll = ttk.Scrollbar(table_wrap, orient=tk.VERTICAL, command=tree.yview)
    tree.configure(yscrollcommand=yscroll.set)

    tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    yscroll.pack(side=tk.RIGHT, fill=tk.Y)

    for k in ESSENTIAL_KEYS:
        if k in core:
            v = core.get(k)
            if isinstance(v, bool):
                v = "Oui" if v else "Non"
            tree.insert("", tk.END, values=(k, v))

    # === Areas & States ===
    # Similar
    similar_title = ttk.Label(root, text="Événements similaires", style="Header.TLabel")
    similar_wrap = ttk.Frame(root, padding=(12, 8))

    # Slider #1: Contextes
    slider_title = ttk.Label(root, text="Contexte par module", style="Header.TLabel")
    slider_wrap = ttk.Frame(root, padding=(12, 8))

    # Slider #2: Business data / Règles métiers
    business_title = ttk.Label(root, text="Règles métiers par module", style="Header.TLabel")
    business_wrap = ttk.Frame(root, padding=(12, 8))

    # Slider #3: Consignes par module (policies)
    policies_title = ttk.Label(root, text="Consignes par module", style="Header.TLabel")
    policies_wrap = ttk.Frame(root, padding=(12, 8))

    # Slider #4: Prompts utilisateur par module
    prompts_title = ttk.Label(root, text="Prompts utilisateur par module", style="Header.TLabel")
    prompts_wrap = ttk.Frame(root, padding=(12, 8))

    # Slider #5: Réponses LLM par module
    llm_title = ttk.Label(root, text="Réponses LLM par module", style="Header.TLabel")
    llm_wrap = ttk.Frame(root, padding=(12, 8))

    suite_click_count = {"n": 0}  # mutable state for closures
    slider_state = {
        "contexts": None,  # Dict[str, Dict]
        "order": [],       # List[str]
        "idx": 0,          # current index in order
    }
    business_state = {
        "biz": None,       # Dict[str, Dict] retourné par df.attach_business_data_to_all_modules
        "order": [],       # List[str]
        "idx": 0,
        "rules_mapping": None,  # pour rappeler les règles du module
    }
    policies_state = {
        "policies_map": None,   # Dict[str, str] -> {module_id: policy_text}
        "order": [],
        "idx": 0,
        "raw_yaml": None,       # modules_policy yaml chargé (pour title/description)
    }
    prompts_state = {
        "prompts_map": None,    # Dict[str, str] -> {module_id: user_prompt_text}
        "order": [],
        "idx": 0,
    }
    llm_state = {
        "responses_map": None,  # Dict[str, str] -> {module_id: llm_response_str}
        "order": [],
        "idx": 0,
    }

    # Helpers for slider
    def _clear_children(widget):
        for c in widget.winfo_children():
            c.destroy()

    def _render_module_card(container: ttk.Frame, module_id: str, ctx: dict):
        _clear_children(container)

        card = ttk.Frame(container)
        card.pack(fill=tk.BOTH, expand=True)

        # En-tête
        head = ttk.Frame(card)
        head.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(head, text=f"Module: {module_id}", style="Header.TLabel").pack(side=tk.LEFT, anchor="w")

        # Règles
        rules = ctx.get("rules", [])
        if rules:
            ttk.Label(card, text=f"Règles: {', '.join(rules)}").pack(anchor="w", padx=2)

        # Champs (table)
        fields = ctx.get("fields", {})
        tbl_wrap = ttk.Frame(card)
        tbl_wrap.pack(fill=tk.BOTH, expand=True, pady=(6, 0))

        columns = ("key", "value")
        tree2 = ttk.Treeview(tbl_wrap, columns=columns, show="headings", height=14)
        tree2.heading("key", text="Champ")
        tree2.heading("value", text="Valeur")
        tree2.column("key", width=380, anchor="w")
        tree2.column("value", width=600, anchor="w")
        yscroll2 = ttk.Scrollbar(tbl_wrap, orient=tk.VERTICAL, command=tree2.yview)
        tree2.configure(yscrollcommand=yscroll2.set)

        tree2.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        yscroll2.pack(side=tk.RIGHT, fill=tk.Y)

        for k, v in list(fields.items()):
            s = v
            if isinstance(s, list):
                s = s[0] if s else None
            if isinstance(s, bool):
                s = "Oui" if s else "Non"
            tree2.insert("", tk.END, values=(k, s))

        # Prompt (si présent)
        prompt = ctx.get("prompt")
        if prompt:
            ttk.Label(card, text="Prompt (aperçu):").pack(anchor="w", pady=(8, 2))
            txt = tk.Text(card, height=6, wrap=tk.WORD)
            txt.insert("1.0", prompt)
            txt.configure(state=tk.DISABLED)
            txt.pack(fill=tk.BOTH, expand=False)

    def _render_business_card(container: ttk.Frame, module_id: str, biz: dict):
        _clear_children(container)

        card = ttk.Frame(container)
        card.pack(fill=tk.BOTH, expand=True)

        # En-tête
        head = ttk.Frame(card)
        head.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(head, text=f"Module: {module_id}", style="Header.TLabel").pack(side=tk.LEFT, anchor="w")

        # Rappeler les règles métiers de ce module si connues
        rm = business_state.get("rules_mapping") or {}
        module_rules = []
        try:
            module_rules = rm.get("modules", {}).get(module_id, {}).get("rules", []) or []
        except Exception:
            module_rules = []
        if module_rules:
            ttk.Label(card, text=f"Règles: {', '.join(module_rules)}").pack(anchor="w", padx=2)

        # Contenu des routes
        routes_wrap = ttk.Frame(card)
        routes_wrap.pack(fill=tk.BOTH, expand=True, pady=(6, 0))

        columns = ("route", "status", "detail")
        tree2 = ttk.Treeview(routes_wrap, columns=columns, show="headings", height=16)
        tree2.heading("route", text="Route")
        tree2.heading("status", text="État")
        tree2.heading("detail", text="Détails")
        tree2.column("route", width=260, anchor="w")
        tree2.column("status", width=120, anchor="w")
        tree2.column("detail", width=600, anchor="w")
        yscroll2 = ttk.Scrollbar(routes_wrap, orient=tk.VERTICAL, command=tree2.yview)
        tree2.configure(yscrollcommand=yscroll2.set)

        tree2.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        yscroll2.pack(side=tk.RIGHT, fill=tk.Y)

        # biz est attendu comme: { route_name: {"url":..., "method":..., "data":..., "error":...}, ...}
        for rname, info in (biz or {}).items():
            method = (info.get("method") or "GET").upper()
            url = info.get("url") or ""
            error = info.get("error")
            data = info.get("data")

            if error:
                status = "Erreur"
                detail = error
            else:
                status = "OK"
                # petit aperçu lisible
                snippet = None
                if isinstance(data, dict):
                    # prendre 1-2 clés significatives
                    keys = list(data.keys())[:2]
                    preview = {k: data.get(k) for k in keys}
                    snippet = json.dumps(preview, ensure_ascii=False)
                elif isinstance(data, list):
                    snippet = f"Liste ({len(data)} éléments)"
                else:
                    snippet = str(type(data))
                detail = f"{method} {url} — {snippet}"

            tree2.insert("", tk.END, values=(rname, status, detail))

    def _render_policy_card(container: ttk.Frame, module_id: str, policy_text: str, raw_yaml: dict | None):
        _clear_children(container)
        card = ttk.Frame(container)
        card.pack(fill=tk.BOTH, expand=True)

        # Metadonnées du module (title/description depuis YAML si dispo)
        title_txt = module_id
        desc_txt = None
        try:
            md = (raw_yaml or {}).get("modules", {}).get(module_id, {}) or {}
            if md.get("title"):
                title_txt = f"{md.get('title')} ({module_id})"
            if md.get("description"):
                desc_txt = md.get("description")
        except Exception:
            pass

        head = ttk.Frame(card)
        head.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(head, text=f"Module: {title_txt}", style="Header.TLabel").pack(side=tk.LEFT, anchor="w")

        if desc_txt:
            ttk.Label(card, text=f"Description: {desc_txt}").pack(anchor="w", padx=2, pady=(0, 6))

        # Zone texte pour la “Consigne” (policy)
        ttk.Label(card, text="Consignes (préambule LLM) :", padding=(0, 4)).pack(anchor="w")
        txt = tk.Text(card, height=18, wrap=tk.WORD)
        txt.insert("1.0", policy_text or "(aucune consigne trouvée)")
        txt.configure(state=tk.DISABLED)
        txt.pack(fill=tk.BOTH, expand=True)

    def _render_prompt_card(container: ttk.Frame, module_id: str, prompt_text: str):
        _clear_children(container)
        card = ttk.Frame(container)
        card.pack(fill=tk.BOTH, expand=True)

        head = ttk.Frame(card)
        head.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(head, text=f"Module: {module_id}", style="Header.TLabel").pack(side=tk.LEFT, anchor="w")

        ttk.Label(card, text="Invite utilisateur (prompt) :", padding=(0, 4)).pack(anchor="w")
        txt = tk.Text(card, height=18, wrap=tk.WORD)
        txt.insert("1.0", prompt_text or "(aucune invite générée)")
        txt.configure(state=tk.DISABLED)
        txt.pack(fill=tk.BOTH, expand=True)

    def _render_llm_response_card(container: ttk.Frame, module_id: str, response_text: str):
        _clear_children(container)
        card = ttk.Frame(container)
        card.pack(fill=tk.BOTH, expand=True)

        head = ttk.Frame(card)
        head.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(head, text=f"Module: {module_id}", style="Header.TLabel").pack(side=tk.LEFT, anchor="w")

        ttk.Label(card, text="Réponse du validateur LLM :", padding=(0, 4)).pack(anchor="w")
        txt = tk.Text(card, height=20, wrap=tk.WORD)
        # petite mise en forme si JSON
        try:
            pretty = json.dumps(json.loads(response_text), ensure_ascii=False, indent=2)
            txt.insert("1.0", pretty)
        except Exception:
            txt.insert("1.0", response_text or "(aucune réponse)")
        txt.configure(state=tk.DISABLED)
        txt.pack(fill=tk.BOTH, expand=True)

    def _render_slider():
        # Context slider
        _clear_children(slider_wrap)

        nav = ttk.Frame(slider_wrap)
        nav.pack(fill=tk.BOTH, expand=True)

        def go_left():
            if not slider_state["order"]:
                return
            slider_state["idx"] = (slider_state["idx"] - 1) % len(slider_state["order"])
            _render_card_at_index()

        def go_right():
            if not slider_state["order"]:
                return
            slider_state["idx"] = (slider_state["idx"] + 1) % len(slider_state["order"])
            _render_card_at_index()

        btn_left = ttk.Button(nav, text="◀", command=go_left, width=3)
        btn_left.pack(side=tk.LEFT, padx=(0, 8))

        card_host = ttk.Frame(nav)
        card_host.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_right = ttk.Button(nav, text="▶", command=go_right, width=3)
        btn_right.pack(side=tk.LEFT, padx=(8, 0))

        def _render_card_at_index():
            order = slider_state["order"]
            idx = slider_state["idx"]
            ctxs = slider_state["contexts"] or {}
            if not order:
                _clear_children(card_host)
                ttk.Label(card_host, text="Aucun module.").pack()
                return
            mid = order[idx]
            ctx = ctxs.get(mid, {"error": "contexte manquant"})
            _render_module_card(card_host, mid, ctx)

        _render_card_at_index()

    def _render_business_slider():
        _clear_children(business_wrap)

        nav = ttk.Frame(business_wrap)
        nav.pack(fill=tk.BOTH, expand=True)

        def go_left():
            if not business_state["order"]:
                return
            business_state["idx"] = (business_state["idx"] - 1) % len(business_state["order"])
            _render_biz_at_index()

        def go_right():
            if not business_state["order"]:
                return
            business_state["idx"] = (business_state["idx"] + 1) % len(business_state["order"])
            _render_biz_at_index()

        btn_left = ttk.Button(nav, text="◀", command=go_left, width=3)
        btn_left.pack(side=tk.LEFT, padx=(0, 8))

        card_host = ttk.Frame(nav)
        card_host.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_right = ttk.Button(nav, text="▶", command=go_right, width=3)
        btn_right.pack(side=tk.LEFT, padx=(8, 0))

        def _render_biz_at_index():
            order = business_state["order"]
            idx = business_state["idx"]
            biz_all = business_state["biz"] or {}
            if not order:
                _clear_children(card_host)
                ttk.Label(card_host, text="Aucun module.").pack()
                return
            mid = order[idx]
            biz = biz_all.get(mid, {})
            _render_business_card(card_host, mid, biz)

        _render_biz_at_index()

    def _render_policies_slider():
        _clear_children(policies_wrap)

        nav = ttk.Frame(policies_wrap)
        nav.pack(fill=tk.BOTH, expand=True)

        def go_left():
            if not policies_state["order"]:
                return
            policies_state["idx"] = (policies_state["idx"] - 1) % len(policies_state["order"])
            _render_policy_at_index()

        def go_right():
            if not policies_state["order"]:
                return
            policies_state["idx"] = (policies_state["idx"] + 1) % len(policies_state["order"])
            _render_policy_at_index()

        btn_left = ttk.Button(nav, text="◀", command=go_left, width=3)
        btn_left.pack(side=tk.LEFT, padx=(0, 8))

        card_host = ttk.Frame(nav)
        card_host.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_right = ttk.Button(nav, text="▶", command=go_right, width=3)
        btn_right.pack(side=tk.LEFT, padx=(8, 0))

        def _render_policy_at_index():
            order = policies_state["order"]
            idx = policies_state["idx"]
            pol_map = policies_state["policies_map"] or {}
            raw_yaml = policies_state["raw_yaml"]
            if not order:
                _clear_children(card_host)
                ttk.Label(card_host, text="Aucun module.").pack()
                return
            mid = order[idx]
            policy_text = pol_map.get(mid, "")
            _render_policy_card(card_host, mid, policy_text, raw_yaml)

        _render_policy_at_index()

    def _render_prompts_slider():
        _clear_children(prompts_wrap)

        nav = ttk.Frame(prompts_wrap)
        nav.pack(fill=tk.BOTH, expand=True)

        def go_left():
            if not prompts_state["order"]:
                return
            prompts_state["idx"] = (prompts_state["idx"] - 1) % len(prompts_state["order"])
            _render_prompt_at_index()

        def go_right():
            if not prompts_state["order"]:
                return
            prompts_state["idx"] = (prompts_state["idx"] + 1) % len(prompts_state["order"])
            _render_prompt_at_index()

        btn_left = ttk.Button(nav, text="◀", command=go_left, width=3)
        btn_left.pack(side=tk.LEFT, padx=(0, 8))

        card_host = ttk.Frame(nav)
        card_host.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_right = ttk.Button(nav, text="▶", command=go_right, width=3)
        btn_right.pack(side=tk.LEFT, padx=(8, 0))

        def _render_prompt_at_index():
            order = prompts_state["order"]
            idx = prompts_state["idx"]
            prom_map = prompts_state["prompts_map"] or {}
            if not order:
                _clear_children(card_host)
                ttk.Label(card_host, text="Aucun module.").pack()
                return
            mid = order[idx]
            prompt_text = prom_map.get(mid, "")
            _render_prompt_card(card_host, mid, prompt_text)

        _render_prompt_at_index()

    def _render_llm_slider():
        _clear_children(llm_wrap)

        nav = ttk.Frame(llm_wrap)
        nav.pack(fill=tk.BOTH, expand=True)

        def go_left():
            if not llm_state["order"]:
                return
            llm_state["idx"] = (llm_state["idx"] - 1) % len(llm_state["order"])
            _render_llm_at_index()

        def go_right():
            if not llm_state["order"]:
                return
            llm_state["idx"] = (llm_state["idx"] + 1) % len(llm_state["order"])
            _render_llm_at_index()

        btn_left = ttk.Button(nav, text="◀", command=go_left, width=3)
        btn_left.pack(side=tk.LEFT, padx=(0, 8))

        card_host = ttk.Frame(nav)
        card_host.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        btn_right = ttk.Button(nav, text="▶", command=go_right, width=3)
        btn_right.pack(side=tk.LEFT, padx=(8, 0))

        def _render_llm_at_index():
            order = llm_state["order"]
            idx = llm_state["idx"]
            resp_map = llm_state["responses_map"] or {}
            if not order:
                _clear_children(card_host)
                ttk.Label(card_host, text="Aucun module.").pack()
                return
            mid = order[idx]
            response_text = resp_map.get(mid, "")
            _render_llm_response_card(card_host, mid, response_text)

        _render_llm_at_index()

    # === Buttons bar ===
    btns = ttk.Frame(root, padding=(12, 0, 12, 12))
    btns.pack(fill=tk.X)

    def on_copy():
        copy_to_clipboard(nl_summary, root)
        messagebox.showinfo("Copié", "Le résumé a été copié dans le presse-papiers.")

    def on_suite_click():
        try:
            suite_click_count["n"] += 1

            # 1er clic: similaires
            if suite_click_count["n"] == 1:
                ids = on_first_click_get_similar_ids()  # returns list[int]
                if not ids:
                    messagebox.showinfo("Similaires", "Aucun similaire renvoyé.")
                    return
                similar_title.pack(anchor="w", padx=12)
                build_similar_cards(similar_wrap, ids)
                similar_wrap.pack(fill=tk.BOTH, expand=False)
                return

            # 2e clic: slider des modules (contextes)
            if suite_click_count["n"] == 2:
                similar_title.pack_forget()
                similar_wrap.pack_forget()

                if slider_state["contexts"] is None:
                    ctxs, order = on_second_click_build_contexts()  # expects (contexts, order_list)
                    slider_state["contexts"] = ctxs or {}
                    slider_state["order"] = order or list((ctxs or {}).keys())
                    slider_state["idx"] = 0

                # cacher les autres blocs si visibles
                business_title.pack_forget()
                business_wrap.pack_forget()
                policies_title.pack_forget()
                policies_wrap.pack_forget()
                prompts_title.pack_forget()
                prompts_wrap.pack_forget()
                llm_title.pack_forget()
                llm_wrap.pack_forget()

                slider_title.pack(anchor="w", padx=12)
                slider_wrap.pack(fill=tk.BOTH, expand=True)
                _render_slider()
                return

            # 3e clic: slider des règles métiers / business data
            if suite_click_count["n"] == 3:
                slider_title.pack_forget()
                slider_wrap.pack_forget()
                policies_title.pack_forget()
                policies_wrap.pack_forget()
                prompts_title.pack_forget()
                prompts_wrap.pack_forget()
                llm_title.pack_forget()
                llm_wrap.pack_forget()

                if business_state["biz"] is None:
                    # récupère data métiers pour tous les modules
                    biz, order, rules_mapping = on_third_click_attach_business_data()
                    business_state["biz"] = biz or {}
                    # ordre : privilégier execution_order si dispo, sinon clés dict
                    business_state["order"] = order or list((biz or {}).keys())
                    business_state["idx"] = 0
                    business_state["rules_mapping"] = rules_mapping

                business_title.pack(anchor="w", padx=12)
                business_wrap.pack(fill=tk.BOTH, expand=True)
                _render_business_slider()
                return

            # 4e clic: slider des consignes (policies)
            if suite_click_count["n"] == 4:
                slider_title.pack_forget()
                slider_wrap.pack_forget()
                business_title.pack_forget()
                business_wrap.pack_forget()
                prompts_title.pack_forget()
                prompts_wrap.pack_forget()
                llm_title.pack_forget()
                llm_wrap.pack_forget()

                if policies_state["policies_map"] is None:
                    pol_map, order, raw_yaml = on_fourth_click_attach_policies()
                    policies_state["policies_map"] = pol_map or {}
                    policies_state["order"] = order or list((pol_map or {}).keys())
                    policies_state["idx"] = 0
                    policies_state["raw_yaml"] = raw_yaml

                policies_title.pack(anchor="w", padx=12)
                policies_wrap.pack(fill=tk.BOTH, expand=True)
                _render_policies_slider()
                return

            # 5e clic: slider des prompts utilisateur
            if suite_click_count["n"] == 5:
                slider_title.pack_forget()
                slider_wrap.pack_forget()
                business_title.pack_forget()
                business_wrap.pack_forget()
                policies_title.pack_forget()
                policies_wrap.pack_forget()
                llm_title.pack_forget()
                llm_wrap.pack_forget()

                if prompts_state["prompts_map"] is None:
                    prom_map, order = on_fifth_click_attach_user_prompts()
                    prompts_state["prompts_map"] = prom_map or {}
                    prompts_state["order"] = order or list((prom_map or {}).keys())
                    prompts_state["idx"] = 0

                prompts_title.pack(anchor="w", padx=12)
                prompts_wrap.pack(fill=tk.BOTH, expand=True)
                _render_prompts_slider()
                return

            # 6e clic (et suivants): slider des réponses LLM
            slider_title.pack_forget()
            slider_wrap.pack_forget()
            business_title.pack_forget()
            business_wrap.pack_forget()
            policies_title.pack_forget()
            policies_wrap.pack_forget()
            prompts_title.pack_forget()
            prompts_wrap.pack_forget()

            if llm_state["responses_map"] is None:
                resp_map, order = on_sixth_click_call_llm()
                llm_state["responses_map"] = resp_map or {}
                llm_state["order"] = order or list((resp_map or {}).keys())
                llm_state["idx"] = 0

            llm_title.pack(anchor="w", padx=12)
            llm_wrap.pack(fill=tk.BOTH, expand=True)
            _render_llm_slider()

        except Exception as e:
            messagebox.showerror("Erreur", f"Suite -> a échoué:\n{e}")

    ttk.Button(btns, text="Copier le résumé", command=on_copy).pack(side=tk.LEFT)
    ttk.Button(btns, text="Suite ->", command=on_suite_click).pack(side=tk.RIGHT)

    root.mainloop()


# ---------- Main ----------
def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Event brief + similar + modules slider + business slider + policies slider + prompts slider + LLM responses slider")
    parser.add_argument("--id", type=int, default=None, help="Event ID to fetch (if omitted, one is sampled)")
    args = parser.parse_args(argv)

    df = DataFactory()
    # Initialise les modules (pour disposer de execution_order et instances)
    try:
        df.modules_initializer("artefacts/llm_modules.yaml")
    except Exception as e:
        print("WARNING: modules_initializer a échoué ou n'est pas disponible:", e)

    try:
        event_id = pick_event_id(args.id)
    except Exception as e:
        traceback.print_exc()
        messagebox.showerror("IDs introuvables", str(e))
        return 2

    title = f"Event #{event_id} — Brief"

    try:
        # FULL CONFIG
        event_full = df.get_full_config(event_id)
        core = extract_core_from_full(event_full)
        # Petite version NL pour copiable
        lines = []
        for k in ESSENTIAL_KEYS:
            if k in core:
                v = core.get(k)
                if isinstance(v, bool):
                    v = "Oui" if v else "Non"
                lines.append(f"• {k}: {v}")
        nl_summary = "\n".join(lines) if lines else "(Aucun champ essentiel trouvé)"
    except Exception as e:
        core = {}
        nl_summary = f"Erreur lors de la récupération de l'événement #{event_id}:\n{e}\n\nTraceback:\n{traceback.format_exc()}"

    # Callbacks pour la fenêtre
    def on_first_click_get_similar_ids() -> List[int]:
        # Retourne 4 IDs, pendant que DF aura caché les FULL configs côté cache
        return df.get_similar_events(event_id)

    def on_second_click_build_contexts():
        # Construit les contextes pour tous les modules + retourne l'ordre
        yaml_path = "artefacts/rules_mapping.yaml"
        if not os.path.isfile(yaml_path):
            raise FileNotFoundError(f"Fichier YAML introuvable: {yaml_path}")
        with open(yaml_path, "r", encoding="utf-8") as f:
            rules_mapping = yaml.safe_load(f)

        ctxs = df.build_contexts_for_all_modules(
            event_full=event_full, # type: ignore
            rules_mapping=rules_mapping,
            event_id=event_id,
        )
        # maintenant que les contextes sont prêts, on peut construire l'historique (si tu as implémenté la méthode DF)
        try:
            df.build_history_for_all_modules(event_id=event_id)
        except Exception:
            pass

        order = getattr(df, "execution_order", None) or list(ctxs.keys())
        # Filtrer pour garder l'ordre connu uniquement
        order = [m for m in order if m in ctxs]
        return ctxs, order

    def on_third_click_attach_business_data():
        # Charge modules_routes + attache la business data pour tous les modules
        modules_routes_yaml_path = "artefacts/modules_routes.yaml"
        if not os.path.isfile(modules_routes_yaml_path):
            raise FileNotFoundError(f"Fichier YAML introuvable: {modules_routes_yaml_path}")
        with open(modules_routes_yaml_path, "r", encoding="utf-8") as f:
            modules_routes = yaml.safe_load(f)

        # Récupère aussi rules_mapping pour rappeler les règles dans les cards
        rules_mapping_yaml_path = "artefacts/rules_mapping.yaml"
        with open(rules_mapping_yaml_path, "r", encoding="utf-8") as f:
            rules_mapping = yaml.safe_load(f)

        biz = df.attach_business_data_to_all_modules(
            modules_routes=modules_routes,
            event_full=event_full,   # type: ignore
        )
        # ordre préférentiel
        order = getattr(df, "execution_order", None) or list(biz.keys())
        order = [m for m in order if m in biz]
        return biz, order, rules_mapping

    def on_fourth_click_attach_policies():
        # Charge les policies par module et les attache aux validateurs
        modules_policy_yaml_path = "artefacts/modules_policy.yaml"
        if not os.path.isfile(modules_policy_yaml_path):
            raise FileNotFoundError(f"Fichier YAML introuvable: {modules_policy_yaml_path}")
        with open(modules_policy_yaml_path, "r", encoding="utf-8") as f:
            modules_policy = yaml.safe_load(f)

        policies_map = df.attach_module_policy(modules_policy=modules_policy)  # {module_id: policy_text}
        # ordre préférentiel
        order = getattr(df, "execution_order", None) or list(policies_map.keys())
        order = [m for m in order if m in policies_map]
        return policies_map, order, modules_policy

    def on_fifth_click_attach_user_prompts():
        # Génère et attache les prompts utilisateur par module (utilise l'historique si disponible)
        prompts_map = df.attach_module_user_prompt(event_id=event_id)
        order = getattr(df, "execution_order", None) or list(prompts_map.keys())
        order = [m for m in order if m in prompts_map]
        return prompts_map, order

    def on_sixth_click_call_llm():
        # Appelle les validateurs LLM pour chaque module et renvoie les réponses
        resp_map = df.call_llm()  # {module_id: str}
        order = getattr(df, "execution_order", None) or list(resp_map.keys())
        order = [m for m in order if m in resp_map]
        return resp_map, order

    build_window(
        title,
        core,
        nl_summary,
        on_first_click_get_similar_ids,
        on_second_click_build_contexts,
        on_third_click_attach_business_data,
        on_fourth_click_attach_policies,
        on_fifth_click_attach_user_prompts,
        on_sixth_click_call_llm,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
