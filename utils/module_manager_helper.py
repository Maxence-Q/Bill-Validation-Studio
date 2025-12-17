
from typing import Dict, Any, List

def build_full_contribution(data: Dict[str, Any]) -> str:
    """
    Flatten récursivement la section en lignes 'full.path[]: value'.
    Utilisé pour tous les modules sauf Prices / PriceGroups.
    """
    if not isinstance(data, dict):
        return ""

    lines: List[str] = []

    def _walk(node: Any, path: str) -> None:
        # Dict → descendre dans les clés
        if isinstance(node, dict):
            for k, v in node.items():
                new_path = f"{path}.{k}" if path else k
                _walk(v, new_path)

        # List → on utilise la notation '[]' dans le path
        elif isinstance(node, list):
            if not node:
                return
            for elem in node:
                # ex: EventDateModelList → EventDateModelList[]
                new_path = path + "[]" if path else "[]"
                _walk(elem, new_path)

        # Scalaire
        else:
            # on skippe les valeurs vides pour alléger un peu
            if node is None or node == "":
                return
            lines.append(f"{path}: {node}")

    _walk(data, "")
    return "\n".join(lines)

def _summarize_price_group_models(section: Dict[str, Any]) -> str:
    """
    Résumé de PriceGroups.PriceGroupModelList :
    une ligne par groupe de prix, avec quelques champs métier clés.
    """
    groups = section.get("PriceGroupModelList") or []
    if not isinstance(groups, list) or not groups:
        return "(no price group models)"

    lines: List[str] = []

    for g in groups:
        if not isinstance(g, dict):
            continue

        gid = g.get("ID")
        name_fr = g.get("NameFR") or g.get("Name") or g.get("TicketingNameFR") or g.get("InternetNameFR")

        favour = g.get("Favour")
        consignment = g.get("Consignment")

        # Membership (si objet RO_MembershipType présent)
        membership = None
        ro_mem = g.get("RO_MembershipType")
        if isinstance(ro_mem, dict):
            membership = ro_mem.get("Description") or ro_mem.get("Name")
        else:
            membership = g.get("MembershipTypeID")

        # POS autorisés → on réduit à une liste d'IDs
        allowed_pos_ids: List[Any] = []
        allowed_pos = g.get("AllowedPointOfSales", [])
        if isinstance(allowed_pos, list):
            for pos in allowed_pos:
                if isinstance(pos, dict):
                    pid = pos.get("PointOfSaleID") or pos.get("ID")
                    if pid is not None:
                        allowed_pos_ids.append(pid)
                else:
                    allowed_pos_ids.append(pos)

        charge_fees1 = g.get("ChargeFees1")
        charge_fees2 = g.get("ChargeFees2")

        min_qty = g.get("MinimumTicketQty")
        max_qty = g.get("MaximumTicketQty")
        hide_internet = g.get("HideOnStandardInternetSale")

        line = (
            f"[PriceGroupModel ID={gid}] "
            f"NameFR={name_fr!r}, "
            f"Favour={favour}, Consignment={consignment}, "
            f"Membership={membership!r}, "
            f"AllowedPOS={allowed_pos_ids}, "
            f"ChargeFees1={charge_fees1}, ChargeFees2={charge_fees2}, "
            f"MinQty={min_qty}, MaxQty={max_qty}, "
            f"HideOnStandardInternetSale={hide_internet}"
        )
        lines.append(line)

    return "\n".join(lines)

def _summarize_prices_pricegroups(section: Dict[str, Any]) -> str:
    """
    Résumé de Prices.PriceGroups :
    pour chaque groupe → son nom + quelques infos + prix par section (réels et fake).
    """
    pg_list = section.get("PriceGroups") or []
    if not isinstance(pg_list, list) or not pg_list:
        return "(no prices)"

    lines: List[str] = []

    for pg in pg_list:
        if not isinstance(pg, dict):
            continue

        pgid = pg.get("PriceGroupID")
        price_group_info = pg.get("PriceGroup") or {}
        name = (
            pg.get("RO_Name")
            or price_group_info.get("PriceGroupNameFr")
            or price_group_info.get("NameFR")
            or price_group_info.get("Name")
            or pgid
        )
        favour = price_group_info.get("Favour")
        membership = None
        ro_mem = price_group_info.get("RO_MembershipType")
        if isinstance(ro_mem, dict):
            membership = ro_mem.get("Description") or ro_mem.get("Name")
        else:
            membership = price_group_info.get("MembershipTypeID")

        header = (
            f"[Prices for PriceGroup ID={pgid}, Name={name!r}, "
            f"Favour={favour}, Membership={membership!r}]"
        )
        lines.append(header)

        prices = pg.get("Prices") or []
        for pr in prices:
            price_obj = pr.get("Price", {}) if isinstance(pr, dict) else {}
            section_id = price_obj.get("SectionID")
            real_price = price_obj.get("Price")
            fake_on_ticket = price_obj.get("FakePriceOnTicket")
            fake_to_show = price_obj.get("FakePriceToShowOnTicket")

            line = (
                f"  SectionID={section_id}: "
                f"Price={real_price}, "
                f"FakePriceOnTicket={fake_on_ticket}, "
                f"FakePriceToShowOnTicket={fake_to_show}"
            )
            lines.append(line)

    return "\n".join(lines)

def _summarize_right_to_sell_and_fees_model(section: Dict[str, Any]) -> str:
    """
    Résume RightToSellAndFees.RightToSellAndFeesModelList en un texte compact.
    - Une entrée par PointOfSale (POS)
    - Pour chaque POS: autorisation, montants de frais (Fee1/Fee2),
      répartition interne/POS, détails des BaseFee1/BaseFee2, groupes de prix.
    """
    model_list = section.get("RightToSellAndFeesModelList") or []
    if not isinstance(model_list, list) or not model_list:
        return "(no RightToSellAndFees)"

    lines: List[str] = []

    for item in model_list:
        if not isinstance(item, dict):
            continue

        # --- Header POS / EventPointOfSale ---
        eps = item.get("EventPointOfSale") or {}
        pos_id = item.get("PointOfSaleID") or eps.get("PointOfSaleID")
        pos_name = item.get("RO_PointOfSaleName") or ""
        is_auth = item.get("IsSaleAutorized")
        if is_auth is None:
            is_auth = eps.get("IsSaleAutorized")

        fee1_amount = eps.get("Fee1Amount")
        fee1_int = eps.get("Fee1IncomeInternal")
        fee1_pos = eps.get("Fee1IncomeForPOS")

        fee2_amount = eps.get("Fee2Amount")
        fee2_int = eps.get("Fee2IncomeInternal")
        fee2_pos = eps.get("Fee2IncomeForPOS")

        header = (
            f"[RightToSell POSID={pos_id} {pos_name!r}] "
            f"IsSaleAutorized={is_auth}, "
            f"Fee1: Amount={fee1_amount}, Internal={fee1_int}, POS={fee1_pos}, "
            f"Fee2: Amount={fee2_amount}, Internal={fee2_int}, POS={fee2_pos}"
        )
        lines.append(header)

        # --- Détail des RightToSellFees (BaseFee1 / BaseFee2 etc.) ---
        fees = item.get("RightToSellFees") or []
        for fee in fees:
            if not isinstance(fee, dict):
                continue
            fee_type = fee.get("FeeType")
            name = fee.get("Name")
            fee_amount = fee.get("FeeAmount")
            income_internal = fee.get("IncomeInternal")
            income_pos = fee.get("IncomeForPOS")

            fee_line = (
                f"  FeeType={fee_type}, Name={name!r}, "
                f"Amount={fee_amount}, "
                f"IncomeInternal={income_internal}, IncomeForPOS={income_pos}"
            )
            lines.append(fee_line)

        # --- Groupes de prix disponibles pour ce POS ---
        pos_price_groups = item.get("POSPriceGroups") or {}
        if isinstance(pos_price_groups, dict) and pos_price_groups:
            # On prend juste les clés (EventPriceGroupID) triées pour être stable
            price_group_ids = sorted(pos_price_groups.keys())
            pg_line = f"  PriceGroupsForPOS={price_group_ids}"
            lines.append(pg_line)

    return "\n".join(lines)

def build_summary_contribution(data: Dict[str, Any]) -> str:
    """
    Résumé pour les grosses sections Prices / PriceGroups.
    - Si 'PriceGroupModelList' est présent → section PriceGroups.
    - Si 'PriceGroups' est présent → section Prices.
    Sinon, fallback sur un flatten complet.
    """
    if not isinstance(data, dict):
        return ""

    if "PriceGroupModelList" in data:
        # module_id == "PriceGroups" en pratique
        return _summarize_price_group_models(data)

    if "PriceGroups" in data:
        # module_id == "Prices" en pratique
        return _summarize_prices_pricegroups(data)
        
    if "RightToSellAndFeesModelList" in data:
        # module_id == "RightToSellAndFees" en pratique
        return _summarize_right_to_sell_and_fees_model(data)

    # sécurité : si jamais tu appelles cette fonction ailleurs
    return build_full_contribution(data)

def event_contribution_for_module(module_id: str, data: Dict[str, Any]) -> str:
    """
    Build user prompt contribution for one event and one module.
    """

    section = data.get(module_id, {})

    if module_id == "Prices" or module_id == "PriceGroups" or module_id == "RightToSellAndFees":
        return build_summary_contribution(section)
    else:
        return build_full_contribution(section)
