"""Transform Reservatech event JSON into LLM-friendly structure."""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


ZERO_UUID = "00000000-0000-0000-0000-000000000000"


def bilingual(obj: dict, fr_key: str, en_key: str) -> dict[str, str] | None:
    """Extract bilingual values as {fr, en} dict. Returns None if both empty."""
    fr = (obj.get(fr_key) or "").strip()
    en = (obj.get(en_key) or "").strip()
    if fr or en:
        return {"fr": fr, "en": en}
    return None


def clean_dict(d: dict) -> dict:
    """Recursively remove keys with None, empty string, or empty list values."""
    result = {}
    for k, v in d.items():
        if v is None or v == "" or v == []:
            continue
        if isinstance(v, dict):
            cleaned = clean_dict(v)
            if cleaned:
                result[k] = cleaned
        elif isinstance(v, list):
            cleaned = []
            for item in v:
                if isinstance(item, dict):
                    c = clean_dict(item)
                    if c:
                        cleaned.append(c)
                else:
                    cleaned.append(item)
            if cleaned:
                result[k] = cleaned
        else:
            result[k] = v
    return result


def is_zero_uuid(val: Any) -> bool:
    """Check if a value is a zero UUID sentinel."""
    return isinstance(val, str) and val == ZERO_UUID


def taxes_applied(tax1_rate: float, tax2_rate: float) -> list[str]:
    """Determine which taxes are applied based on non-zero rates."""
    taxes = []
    if tax1_rate and tax1_rate > 0:
        taxes.append("TPS")
    if tax2_rate and tax2_rate > 0:
        taxes.append("TVQ")
    return taxes


def compute_default_taxes(data: dict) -> list[str] | None:
    """Return the universal tax pattern if all price/fee entries share the same one.

    Returns None if the tax pattern is heterogeneous across entries.
    """
    patterns: set[tuple[bool, bool]] = set()

    # Scan prices
    for pg in data.get("Prices", {}).get("PriceGroups", []):
        for pe in pg.get("Prices", []):
            p = pe.get("Price", {})
            patterns.add((
                bool(p.get("Tax1Rate", 0) and p.get("Tax1Rate", 0) > 0),
                bool(p.get("Tax2Rate", 0) and p.get("Tax2Rate", 0) > 0),
            ))

    # Scan fees
    for entry in data.get("RightToSellAndFees", {}).get(
        "RightToSellAndFeesModelList", []
    ):
        for fee in entry.get("RightToSellFees", []):
            patterns.add((
                bool(fee.get("Tax1Rate", 0) and fee.get("Tax1Rate", 0) > 0),
                bool(fee.get("Tax2Rate", 0) and fee.get("Tax2Rate", 0) > 0),
            ))

    if len(patterns) != 1:
        return None

    has_t1, has_t2 = patterns.pop()
    taxes: list[str] = []
    if has_t1:
        taxes.append("TPS")
    if has_t2:
        taxes.append("TVQ")
    return taxes


def parse_local_datetime(s: str) -> datetime | None:
    """Parse an ISO-like local datetime string. Returns None on failure."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.rstrip("Z"))
    except (ValueError, TypeError):
        return None


def days_between(earlier: str, later: str) -> float | None:
    """Compute days between two ISO datetime strings. Returns None if either is missing."""
    a = parse_local_datetime(earlier)
    b = parse_local_datetime(later)
    if a is None or b is None:
        return None
    return round((b - a).total_seconds() / 86400, 1)


def hours_between(earlier: str, later: str) -> float | None:
    """Compute hours between two ISO datetime strings. Returns None if either is missing."""
    a = parse_local_datetime(earlier)
    b = parse_local_datetime(later)
    if a is None or b is None:
        return None
    return round((b - a).total_seconds() / 3600, 1)


# ---------------------------------------------------------------------------
# Lookup builders
# ---------------------------------------------------------------------------


def build_section_lookup(data: dict) -> dict[int, str]:
    """Build a mapping from SectionID to label."""
    sections: dict[int, str] = {}
    for pg in data.get("Prices", {}).get("PriceGroups", []):
        for price_entry in pg.get("Prices", []):
            sid = price_entry.get("Price", {}).get("SectionID", 0)
            if sid and sid > 0:
                sections[sid] = f"Section_{sid}"
    return sections


def build_pos_name_lookup(data: dict) -> dict[int, str]:
    """Build a mapping from PointOfSaleID to POS name."""
    lookup: dict[int, str] = {}
    rts = data.get("RightToSellAndFees", {})
    for entry in rts.get("RightToSellAndFeesModelList", []):
        pos_id = entry.get("PointOfSaleID", 0)
        pos_name = entry.get("RO_PointOfSaleName", f"POS_{pos_id}")
        if pos_id:
            lookup[pos_id] = pos_name
    return lookup


def build_price_group_name_lookup(data: dict) -> dict[int, str]:
    """Build a mapping from PriceGroupID to name."""
    lookup: dict[int, str] = {}
    for pg in data.get("PriceGroups", {}).get("PriceGroupModelList", []):
        pg_id = pg.get("ID", 0)
        pg_name = pg.get("Name", pg.get("NameFR", f"Group_{pg_id}"))
        if pg_id:
            lookup[pg_id] = pg_name
    return lookup


# ---------------------------------------------------------------------------
# Domain transformers
# ---------------------------------------------------------------------------


def transform_event(data: dict) -> dict:
    """Transform event-level data."""
    event_outer = data.get("Event", {})
    event_inner = event_outer.get("Event", {})
    rep_type = event_outer.get("RO_RepresentationType") or {}
    activity_type = event_outer.get("RO_ActivityType") or {}

    result: dict[str, Any] = {}

    name = bilingual(event_inner, "NameFr", "NameEn")
    if name:
        result["name"] = name

    internet_name = bilingual(event_inner, "InternetName_Fr", "InternetName_En")
    if internet_name:
        result["internet_name"] = internet_name

    long_desc = bilingual(event_inner, "LongDescription_Fr", "LongDescription_En")
    if long_desc:
        result["long_description"] = long_desc

    artist = (event_inner.get("ArtistName") or "").strip()
    if artist:
        result["artist_name"] = artist

    genre = bilingual(rep_type, "NameFr", "NameEn")
    if genre:
        result["genre"] = genre

    act_desc = activity_type.get("Description", "")
    if act_desc:
        result["activity_type"] = act_desc

    pt = event_inner.get("ProductType", "")
    if pt:
        result["product_type"] = pt

    max_tickets = event_inner.get("TicketLimitNumber", 0)
    if max_tickets:
        result["max_tickets_per_order"] = max_tickets

    presale_hours = event_inner.get("MembershipPresaleDurationHours", 0)
    if presale_hours:
        result["membership_presale_hours"] = presale_hours

    result["status"] = {
        "is_on_sale": event_inner.get("IsInSale", False),
        "is_general_admission": event_inner.get("IsGeneralAdmission", False),
        "is_history": event_inner.get("IsHistory", False),
        "is_demo": event_inner.get("IsDemoEvent", False),
    }

    result["internet_settings"] = {
        "display_on_internet": event_inner.get("DisplayOnTheInternet", False),
        "show_available_places": event_inner.get("ShowAvailablePlacesOnInternet", False),
        "show_best_ticket_first": event_inner.get("ShowBestTicketFirstOnInternet", False),
        "is_guest_client_authorized": event_inner.get("IsGuestClientAuthorized", False),
        "always_ask_for_price_on_ticket_selection": event_inner.get(
            "AlwaysAskForPriceOnTicketSelection", False
        ),
    }

    result["delivery"] = {
        "mail_shipping_available": event_inner.get("SupportMailShipping", False),
        "eticket_available": event_inner.get("SupportETicketShipping", False),
        "shipping_mandatory": event_inner.get("IsShippingMandatory", False),
    }

    return result


def transform_venue(data: dict) -> dict:
    """Transform venue/POS data."""
    event = data.get("Event", {})
    pos = event.get("OwnerPOS") or {}
    tz = event.get("Timezone") or {}

    result: dict[str, Any] = {"name": pos.get("Name", "")}

    result["address"] = {
        "street": pos.get("Address", ""),
        "city": pos.get("City", ""),
        "province": pos.get("Province", ""),
        "postal_code": pos.get("PostalCode", ""),
        "country": pos.get("Country", ""),
        "region": pos.get("Region", ""),
    }

    contact: dict[str, str] = {
        "phone": pos.get("Phone", ""),
        "email": pos.get("Email", ""),
    }
    eticket_email = pos.get("ETicketEmailFrom", "")
    if eticket_email and eticket_email != pos.get("Email", ""):
        contact["eticket_email_from"] = eticket_email
    result["contact"] = contact

    sig = bilingual(pos, "EmailSignatureFr", "EmailSignatureEn")
    if sig:
        result["email_signature"] = sig

    result["timezone"] = {
        "iana_id": tz.get("TZDatabaseID", ""),
        "standard_offset_hours": tz.get("StandardTimeOffsetHour", 0),
        "daylight_offset_hours": tz.get("DaylightSavingTimeOffsetHour", 0),
        "abbreviation": bilingual(
            tz, "StandardTimeAbbreviationFr", "StandardTimeAbbreviationEn"
        ),
        "daylight_abbreviation": bilingual(
            tz,
            "DaylightSavingTimeAbbreviationFr",
            "DaylightSavingTimeAbbreviationEn",
        ),
    }

    entity_type = pos.get("EntityType", "")
    if entity_type:
        result["entity_type"] = entity_type

    if pos.get("EventReminderEnabled"):
        result["event_reminder"] = {
            "enabled": True,
            "template": pos.get("EventReminderTemplate", ""),
            "days_before": pos.get("EventReminderDaysBefore", 0),
        }

    return result


def transform_producer(data: dict) -> dict:
    """Transform producer data."""
    producer = data.get("Event", {}).get("RO_Producer") or {}
    result: dict[str, Any] = {}

    name = producer.get("Name", "")
    if name:
        result["name"] = name
    email = producer.get("Email", "")
    if email:
        result["email"] = email
    freq = producer.get("ReportFrequency", "")
    if freq:
        result["report_frequency"] = freq

    return result


def transform_performances(data: dict) -> list[dict]:
    """Transform event dates into performances."""
    performances: list[dict] = []

    for entry in data.get("EventDates", {}).get("EventDateModelList", []):
        perf: dict[str, Any] = {}

        code = entry.get("Code", "")
        if code:
            perf["code"] = code

        name = bilingual(entry, "RepresentationNameFR", "RepresentationNameEN")
        if name:
            perf["name"] = name

        date_utc = entry.get("Date", "")
        if date_utc:
            perf["date_utc"] = date_utc

        date_local = entry.get("RO_Date_Local", "")
        if date_local:
            perf["date_local"] = date_local

        desc = bilingual(entry, "DescriptionFR", "DescriptionEN")
        if desc:
            perf["description"] = desc

        venue = entry.get("Venue") or {}
        vname = venue.get("DisplayName") or venue.get("Name", "")
        if vname:
            perf["venue_name"] = vname

        # Sales windows using local dates
        sales_windows: dict[str, dict] = {}
        for channel_key, label in [
            ("BoxOffice", "box_office"),
            ("Network", "network"),
            ("Internet", "internet"),
        ]:
            start = entry.get(f"RO_SalesStartDate{channel_key}_Local", "")
            end = entry.get(f"RO_SalesEndDate{channel_key}_Local", "")
            if start or end:
                sales_windows[label] = {"start": start, "end": end}

        if sales_windows:
            perf["sales_windows"] = sales_windows

        perf["status"] = {
            "cancelled": entry.get("Cancelled", False),
            "sold_out": entry.get("IsSoldOut", False),
            "hidden_on_internet": entry.get("HideOnInternet", False),
            "auto_client": entry.get("IsAutoClient", False),
        }

        performances.append(perf)

    return performances


def transform_pricing(
    data: dict,
    section_lookup: dict[int, str],
    pos_lookup: dict[int, str],
    default_taxes: list[str] | None = None,
) -> dict:
    """Transform pricing data."""
    prices_data = data.get("Prices", {})
    pg_model_list = data.get("PriceGroups", {}).get("PriceGroupModelList", [])

    # Index PriceGroupModelList by ID for fast lookup
    pg_model_by_id: dict[int, dict] = {}
    pg_allowed_pos: dict[int, list] = {}
    for pg in pg_model_list:
        pid = pg.get("ID", 0)
        if pid:
            pg_model_by_id[pid] = pg
            pg_allowed_pos[pid] = pg.get("AllowedPointOfSales", [])

    # Discover applicable tax rates from the first non-zero priced entry
    tax_rates: dict[str, float] = {}
    for pg in prices_data.get("PriceGroups", []):
        for price_entry in pg.get("Prices", []):
            p = price_entry.get("Price", {})
            t1 = p.get("Tax1Rate", 0)
            t2 = p.get("Tax2Rate", 0)
            if t1 and t1 > 0:
                tax_rates.setdefault("TPS", t1)
            if t2 and t2 > 0:
                tax_rates.setdefault("TVQ", t2)
            if len(tax_rates) >= 2:
                break
        if len(tax_rates) >= 2:
            break

    section_order = sorted(section_lookup.values())

    result: dict[str, Any] = {
        "applicable_taxes": [
            {"name": name, "rate": rate} for name, rate in tax_rates.items()
        ],
        "sections": section_order,
        "price_groups": [],
    }

    for pg_entry in prices_data.get("PriceGroups", []):
        pg_info = pg_entry.get("PriceGroup", {})
        pg_id = pg_info.get("ID", 0)

        group: dict[str, Any] = {}

        name = bilingual(pg_info, "PriceGroupNameFr", "PriceGroupNameEn")
        if name:
            group["name"] = name

        group["is_active"] = pg_info.get("PriceGroupActive", False)
        group["is_favour"] = pg_info.get("Favour", False)
        group["is_consignment"] = pg_info.get("Consignment", False)
        group["charge_fee1"] = pg_info.get("ChargeFees1", False)
        group["charge_fee2"] = pg_info.get("ChargeFees2", False)
        group["hide_on_internet"] = pg_info.get("HideOnStandardInternetSale", False)

        # Quantity constraints
        qty_constraints: dict[str, Any] = {}
        if pg_info.get("HasMaximumTicketSoldPerEventDate"):
            max_per_date = pg_info.get("MaximumTicketSoldPerEventDate", 0)
            if max_per_date > 0:
                qty_constraints["max_tickets_per_event_date"] = max_per_date
        if pg_info.get("IsMinimumQtyActivated"):
            min_qty = pg_info.get("MinimumTicketQty", 0)
            if min_qty > 0:
                qty_constraints["minimum_quantity"] = min_qty
        if pg_info.get("IsMaximumQtyActivated"):
            max_qty = pg_info.get("MaximumTicketQty", 0)
            if max_qty > 0:
                qty_constraints["maximum_quantity"] = max_qty
        multiple_of = pg_info.get("RequiredTicketQTYMultipleOf", 0)
        if multiple_of and multiple_of > 0:
            qty_constraints["required_multiple_of"] = multiple_of
        if qty_constraints:
            group["quantity_constraints"] = qty_constraints

        # Membership requirement (deduplicated via model lookup)
        membership_id = pg_info.get("MembershipTypeID", "")
        if membership_id and not is_zero_uuid(membership_id):
            model = pg_model_by_id.get(pg_id, {})
            mt = model.get("RO_MembershipType")
            if mt:
                membership: dict[str, Any] = {}
                mname = bilingual(mt, "NameFr", "NameEn")
                if mname:
                    membership["name"] = mname
                mtype = mt.get("Type", "")
                if mtype:
                    membership["type"] = mtype
                dur = mt.get("Duration", 0)
                dur_unit = mt.get("DurationUnit", "")
                if dur and dur_unit:
                    membership["duration"] = f"{dur} {dur_unit}"
                membership["is_active"] = mt.get("IsActive", False)
                group["membership_required"] = membership

        # Credit card condition flag
        cc_id = pg_info.get("CreditCardConditionID", "")
        if cc_id and not is_zero_uuid(cc_id):
            group["has_credit_card_condition"] = True

        # Allowed sales channels
        allowed = pg_allowed_pos.get(pg_id, [])
        if allowed:
            group["allowed_sales_channels"] = [
                pos_lookup.get(a.get("PointOfSaleID", 0), f"POS_{a.get('PointOfSaleID', 0)}")
                for a in allowed
            ]
        else:
            group["allowed_sales_channels"] = "all"

        # Prices as positional arrays aligned to section_order
        raw_by_section: dict[str, dict] = {}
        for price_entry in pg_entry.get("Prices", []):
            p = price_entry.get("Price", {})
            sid = p.get("SectionID", 0)
            if not sid or sid <= 0:
                continue
            section_name = section_lookup.get(sid, f"Section_{sid}")
            entry_data: dict[str, Any] = {"price": p.get("Price", 0)}

            # Only emit taxes_applied when it differs from the default
            entry_taxes = taxes_applied(
                p.get("Tax1Rate", 0), p.get("Tax2Rate", 0)
            )
            if entry_taxes != default_taxes:
                entry_data["taxes_override"] = entry_taxes

            if p.get("FakePriceOnTicket"):
                fake = p.get("FakePriceToShowOnTicket", 0)
                if fake:
                    entry_data["display_price_on_ticket"] = fake
            if p.get("FakeFeesOnTicket"):
                fake_fees = p.get("FakeFeesToShowOnTicket", 0)
                if fake_fees:
                    entry_data["display_fees_on_ticket"] = fake_fees

            raw_by_section[section_name] = entry_data

        if raw_by_section:
            group["prices"] = [
                raw_by_section.get(s, {}).get("price", 0) for s in section_order
            ]

            # Parallel display_prices array (only if any entry has it)
            display_prices = [
                raw_by_section.get(s, {}).get("display_price_on_ticket", 0)
                for s in section_order
            ]
            if any(dp > 0 for dp in display_prices):
                group["display_prices"] = display_prices

            # Parallel display_fees array (only if any entry has it)
            display_fees = [
                raw_by_section.get(s, {}).get("display_fees_on_ticket", 0)
                for s in section_order
            ]
            if any(df > 0 for df in display_fees):
                group["display_fees"] = display_fees

            # Per-section tax overrides (only if any section differs)
            overrides = {
                s: raw_by_section[s]["taxes_override"]
                for s in section_order
                if s in raw_by_section and "taxes_override" in raw_by_section[s]
            }
            if overrides:
                group["taxes_override_by_section"] = overrides

        result["price_groups"].append(group)

    return result


def transform_sales_channels(
    data: dict,
    pg_name_lookup: dict[int, str],
    default_taxes: list[str] | None = None,
) -> list[dict]:
    """Transform RightToSellAndFees into sales channels."""
    channels: list[dict] = []

    for entry in (
        data.get("RightToSellAndFees", {}).get("RightToSellAndFeesModelList", [])
    ):
        channel: dict[str, Any] = {}

        pos_name = entry.get("RO_PointOfSaleName", "")
        if pos_name:
            channel["name"] = pos_name

        channel["is_sale_authorized"] = entry.get("IsSaleAutorized", False)

        # Authorization date
        event_pos = entry.get("EventPointOfSale", {})
        auth_date = event_pos.get("AutorisationDate", "")
        if auth_date:
            channel["authorization_date"] = auth_date

        # Fees
        fees: dict[str, dict] = {}
        for fee in entry.get("RightToSellFees", []):
            fee_type = fee.get("FeeType", "")
            # "BaseFee1" -> "fee1", "BaseFee2" -> "fee2"
            fee_key = fee_type.lower().replace("base", "")
            fee_entry: dict[str, Any] = {
                "name": fee.get("Name", fee_type),
                "amount": fee.get("FeeAmount", 0),
            }
            # Only emit taxes_applied when it differs from the default
            fee_taxes = taxes_applied(
                fee.get("Tax1Rate", 0), fee.get("Tax2Rate", 0)
            )
            if fee_taxes != default_taxes:
                fee_entry["taxes_applied"] = fee_taxes
            fees[fee_key] = fee_entry
        if fees:
            channel["fees"] = fees

        # Authorized price groups (resolve IDs to names)
        pos_pgs = entry.get("POSPriceGroups", {})
        authorized = sorted(
            pg_name_lookup.get(int(pg_id), f"Group_{pg_id}")
            for pg_id in pos_pgs
        )
        if authorized:
            channel["authorized_price_groups"] = authorized

        channels.append(channel)

    return channels


# ---------------------------------------------------------------------------
# Computed insights
# ---------------------------------------------------------------------------


def _prices_by_section(pg: dict, sections: list[str]) -> dict[str, float]:
    """Reconstruct {section_name: price} from a price group's positional array."""
    prices = pg.get("prices", [])
    return {s: p for s, p in zip(sections, prices) if p is not None}


def _pg_name_fr(pg: dict) -> str:
    """Extract French name from a price group (handles both dict and str)."""
    name = pg.get("name", "Unknown")
    if isinstance(name, dict):
        return name.get("fr", "Unknown")
    return name if isinstance(name, str) else "Unknown"


def compute_insights(transformed: dict) -> dict:
    """Compute derived analytics from the transformed output."""
    pricing = transformed.get("pricing", {})
    price_groups = pricing.get("price_groups", [])
    sections = pricing.get("sections", [])
    channels = transformed.get("sales_channels", [])
    performances = transformed.get("performances", [])
    event = transformed.get("event", {})
    venue = transformed.get("venue", {})

    insights: dict[str, Any] = {}

    # --- Pricing Summary ---
    paid_prices: list[tuple[str, float]] = []
    comp_group_names: list[str] = []
    paid_groups: list[dict] = []

    for pg in price_groups:
        if pg.get("is_favour"):
            comp_group_names.append(_pg_name_fr(pg))
            continue
        paid_groups.append(pg)
        for section_name, price in _prices_by_section(pg, sections).items():
            if price > 0:
                paid_prices.append((section_name, price))

    pricing_summary: dict[str, Any] = {}

    if paid_prices:
        all_prices = [p for _, p in paid_prices]
        pricing_summary["price_range"] = {
            "min": min(all_prices),
            "max": max(all_prices),
            "currency_note": "before tax",
        }

        # Detect section tiers from the first paid group
        if paid_groups:
            section_by_price: dict[float, list[str]] = {}
            for sn, p in _prices_by_section(paid_groups[0], sections).items():
                if p > 0:
                    section_by_price.setdefault(p, []).append(sn)

            if len(section_by_price) > 1:
                tier_labels = ["premium", "standard", "economy"]
                tiers = []
                for i, price in enumerate(sorted(section_by_price, reverse=True)):
                    label = tier_labels[i] if i < len(tier_labels) else f"tier_{i + 1}"
                    tiers.append({
                        "tier": label,
                        "sections": sorted(section_by_price[price]),
                        "base_price": price,
                    })
                pricing_summary["section_tiers"] = tiers

                sorted_prices = sorted(section_by_price, reverse=True)
                if len(sorted_prices) >= 2 and sorted_prices[1] > 0:
                    pricing_summary["premium_to_standard_ratio"] = round(
                        sorted_prices[0] / sorted_prices[1], 2
                    )

    pricing_summary["paid_groups_count"] = len(paid_groups)
    pricing_summary["complimentary_groups_count"] = len(comp_group_names)
    if comp_group_names:
        pricing_summary["complimentary_group_names"] = comp_group_names
    insights["pricing_summary"] = pricing_summary

    # --- Group Comparisons ---
    baseline = None
    baseline_name = None
    for pg in paid_groups:
        if not pg.get("membership_required") and not pg.get("has_credit_card_condition"):
            baseline = pg
            baseline_name = _pg_name_fr(pg)
            break

    if baseline and len(paid_groups) > 1:
        baseline_section_prices = {
            sn: p
            for sn, p in _prices_by_section(baseline, sections).items()
            if p > 0
        }
        comparisons = []
        for pg in paid_groups:
            pg_name = _pg_name_fr(pg)
            if pg_name == baseline_name:
                continue

            pg_section_prices = _prices_by_section(pg, sections)
            ratios: dict[str, float] = {}
            for sn, bp in baseline_section_prices.items():
                pg_price = pg_section_prices.get(sn, 0)
                if pg_price > 0 and bp > 0:
                    ratios[sn] = round(pg_price / bp, 2)

            if not ratios:
                continue

            comp: dict[str, Any] = {"group": pg_name}
            unique = set(ratios.values())
            if len(unique) == 1:
                ratio = unique.pop()
                comp["vs_baseline"] = ratio
                if ratio < 1:
                    comp["note"] = f"{round((1 - ratio) * 100)}% discount"
                elif ratio > 1:
                    comp["note"] = f"{round((ratio - 1) * 100)}% premium"
            else:
                comp["vs_baseline_by_section"] = ratios

            notes: list[str] = []
            if comp.get("note"):
                notes.append(comp["note"])
            if pg.get("membership_required"):
                mname = pg["membership_required"].get("name", {}).get("fr", "membership")
                notes.append(f"requires {mname}")
            if pg.get("has_credit_card_condition"):
                notes.append("credit card condition")
            if notes:
                comp["note"] = ", ".join(notes)

            comparisons.append(comp)

        if comparisons:
            insights["group_comparisons"] = {
                "baseline_group": baseline_name,
                "comparisons": comparisons,
            }

    # --- Fee Impact ---
    if channels and paid_prices:
        fees = channels[0].get("fees", {})
        total_fees = sum(f.get("amount", 0) for f in fees.values())
        if total_fees > 0:
            all_prices = [p for _, p in paid_prices]
            min_p, max_p = min(all_prices), max(all_prices)
            insights["fee_impact"] = {
                "total_fees_before_tax": round(total_fees, 2),
                "fee_as_pct_of_cheapest_ticket": round(total_fees / min_p, 2) if min_p > 0 else None,
                "fee_as_pct_of_most_expensive_ticket": round(total_fees / max_p, 2) if max_p > 0 else None,
            }

    # --- Sales Channel Summary ---
    channel_names = [c.get("name", "") for c in channels]
    if channel_names:
        internet_groups: set[str] = set()
        all_groups: set[str] = set()
        for ch in channels:
            groups = set(ch.get("authorized_price_groups", []))
            all_groups.update(groups)
            if ch.get("name", "").lower() == "internet":
                internet_groups = groups

        summary: dict[str, Any] = {
            "total_channels": len(channels),
            "channel_names": channel_names,
        }
        box_office_only = sorted(all_groups - internet_groups) if internet_groups else []
        if box_office_only:
            summary["box_office_only_groups"] = box_office_only
        insights["sales_channel_summary"] = summary

    # --- Event Profile ---
    section_tiers = pricing_summary.get("section_tiers", [])
    profile: dict[str, Any] = {
        "number_of_performances": len(performances),
        "number_of_sections": len(pricing.get("sections", [])),
        "number_of_section_tiers": len(section_tiers),
        "has_membership_pricing": any(pg.get("membership_required") for pg in price_groups),
        "has_complimentary_tickets": any(pg.get("is_favour") for pg in price_groups),
        "has_credit_card_conditions": any(
            pg.get("has_credit_card_condition") for pg in price_groups
        ),
    }

    genre = event.get("genre")
    if isinstance(genre, dict) and genre.get("fr"):
        profile["genre"] = genre["fr"]

    city = venue.get("address", {}).get("city", "")
    if city:
        profile["venue_city"] = city

    # --- Performance Schedule ---
    schedule_entries: list[dict] = []
    for perf in performances:
        date_str = perf.get("date_local", "")
        dt = parse_local_datetime(date_str)
        if not dt:
            continue
        sched: dict[str, Any] = {"code": perf.get("code", "")}
        sched["day_of_week"] = dt.strftime("%A")
        sched["show_time"] = dt.strftime("%H:%M")
        hour = dt.hour
        if hour < 17:
            sched["time_category"] = "matinee"
        elif hour < 21:
            sched["time_category"] = "evening"
        else:
            sched["time_category"] = "late_night"
        schedule_entries.append(sched)

    if schedule_entries:
        day_counts: dict[str, int] = {}
        time_counts: dict[str, int] = {}
        for se in schedule_entries:
            day_counts[se["day_of_week"]] = day_counts.get(se["day_of_week"], 0) + 1
            time_counts[se["time_category"]] = time_counts.get(se["time_category"], 0) + 1
        insights["performance_schedule"] = {
            "performances": schedule_entries,
            "day_of_week_distribution": day_counts,
            "time_category_distribution": time_counts,
        }

    # --- Sales Timeline ---
    presale_hours = event.get("membership_presale_hours", 0)
    now = datetime.now()
    timeline_entries: list[dict] = []

    for perf in performances:
        code = perf.get("code", "")
        date_str = perf.get("date_local", "")
        windows = perf.get("sales_windows", {})
        bo = windows.get("box_office", {})
        inet = windows.get("internet", {})
        net = windows.get("network", {})

        entry: dict[str, Any] = {"code": code}

        # Sales window duration per channel (days)
        channel_durations: dict[str, float] = {}
        for label, ch in [("box_office", bo), ("network", net), ("internet", inet)]:
            d = days_between(ch.get("start", ""), ch.get("end", ""))
            if d is not None:
                channel_durations[label] = d
        if channel_durations:
            entry["sales_window_days"] = channel_durations

        # Box office head start (days before internet opens)
        head_start = days_between(bo.get("start", ""), inet.get("start", ""))
        if head_start is not None and head_start > 0:
            entry["box_office_head_start_days"] = head_start

        # Internet close vs performance (hours)
        gap_hours = hours_between(inet.get("end", ""), date_str)
        if gap_hours is not None:
            entry["internet_close_to_performance_hours"] = gap_hours

        # Membership presale window
        if presale_hours and inet.get("start", ""):
            inet_dt = parse_local_datetime(inet.get("start", ""))
            if inet_dt:
                presale_start = inet_dt - timedelta(hours=presale_hours)
                entry["membership_presale"] = {
                    "starts": presale_start.isoformat(),
                    "hours_before_internet": presale_hours,
                }

        # Days until performance
        perf_dt = parse_local_datetime(date_str)
        if perf_dt:
            days_away = (perf_dt - now).total_seconds() / 86400
            entry["days_until_performance"] = round(days_away, 1)

        timeline_entries.append(entry)

    if timeline_entries:
        insights["sales_timeline"] = {
            "computed_at": now.isoformat(),
            "performances": timeline_entries,
        }

    # --- Authorization Timeline ---
    auth_entries: list[dict] = []
    for ch in channels:
        auth_date = ch.get("authorization_date", "")
        if not auth_date:
            continue
        ch_name = ch.get("name", "")
        auth_entry: dict[str, Any] = {
            "channel": ch_name,
            "authorization_date": auth_date,
        }
        # Gap to earliest sales start from first performance
        if performances:
            first_windows = performances[0].get("sales_windows", {})
            earliest_start: str | None = None
            for w in first_windows.values():
                s = w.get("start", "")
                if s and (earliest_start is None or s < earliest_start):
                    earliest_start = s
            if earliest_start:
                gap = days_between(auth_date, earliest_start)
                if gap is not None:
                    auth_entry["authorization_to_first_sale_days"] = gap
        auth_entries.append(auth_entry)

    if auth_entries:
        insights["authorization_timeline"] = auth_entries

    # --- Quantity Constraints Summary ---
    groups_with_constraints: list[dict] = []
    for pg in price_groups:
        constraints = pg.get("quantity_constraints")
        if not constraints:
            continue
        groups_with_constraints.append({"group": _pg_name_fr(pg), **constraints})

    if groups_with_constraints:
        insights["quantity_constraints_summary"] = {
            "groups_with_constraints": groups_with_constraints,
            "total_constrained_groups": len(groups_with_constraints),
        }
    else:
        insights["quantity_constraints_summary"] = {
            "note": "no quantity constraints active on any price group",
        }

    # --- Fee Breakdown ---
    fee_breakdown_channels: list[dict] = []
    for ch in channels:
        ch_name = ch.get("name", "")
        ch_fees = ch.get("fees", {})
        if not ch_fees:
            continue

        channel_breakdown: dict[str, Any] = {"channel": ch_name, "fees": []}
        channel_total = 0.0

        for fee_key, fee_data in ch_fees.items():
            amount = fee_data.get("amount", 0)
            fee_info: dict[str, Any] = {
                "fee": fee_data.get("name", fee_key),
                "amount": amount,
            }
            # Only include taxes_applied in insight if it was an override
            if "taxes_applied" in fee_data:
                fee_info["taxes_applied"] = fee_data["taxes_applied"]
            channel_breakdown["fees"].append(fee_info)
            channel_total += amount

        channel_breakdown["total_fees_before_tax"] = round(channel_total, 2)

        # Which price groups are charged which fees
        fee_applicability: list[dict] = []
        for pg in price_groups:
            charged = []
            if pg.get("charge_fee1"):
                charged.append("fee1")
            if pg.get("charge_fee2"):
                charged.append("fee2")
            if charged:
                fee_applicability.append({"group": _pg_name_fr(pg), "charged_fees": charged})

        if fee_applicability:
            channel_breakdown["fee_applicability_by_group"] = fee_applicability

        fee_breakdown_channels.append(channel_breakdown)

    if fee_breakdown_channels:
        insights["fee_breakdown"] = fee_breakdown_channels

    # Finalize event profile with new flags
    profile["has_quantity_constraints"] = any(
        pg.get("quantity_constraints") for pg in price_groups
    )
    profile["has_multiple_show_times"] = (
        len(set(se.get("time_category") for se in schedule_entries)) > 1
        if schedule_entries
        else False
    )

    insights["event_profile"] = profile

    return insights


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


def transform(data: dict) -> dict:
    """Orchestrate all transformations."""
    section_lookup = build_section_lookup(data)
    pos_lookup = build_pos_name_lookup(data)
    pg_name_lookup = build_price_group_name_lookup(data)
    default_taxes = compute_default_taxes(data)

    metadata: dict[str, Any] = {
        "source_system": "Reservatech",
        "description": "LLM-friendly event data",
    }
    if default_taxes:
        metadata["default_taxes"] = default_taxes
        metadata["default_taxes_note"] = (
            "All prices and fees use these taxes unless overridden"
        )

    result = {
        "_metadata": metadata,
        "event": transform_event(data),
        "venue": transform_venue(data),
        "producer": transform_producer(data),
        "performances": transform_performances(data),
        "pricing": transform_pricing(data, section_lookup, pos_lookup, default_taxes),
        "sales_channels": transform_sales_channels(
            data, pg_name_lookup, default_taxes
        ),
    }

    result["_insights"] = compute_insights(result)
    return clean_dict(result)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Transform Reservatech event JSON to LLM-friendly format"
    )
    parser.add_argument(
        "-i", "--input", required=True, type=Path, help="Input JSON file path"
    )
    parser.add_argument(
        "-o", "--output", required=True, type=Path, help="Output JSON file path"
    )
    parser.add_argument(
        "--indent", type=int, default=2, help="JSON indent (default: 2)"
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    with open(args.input, encoding="utf-8") as f:
        data = json.load(f)

    result = transform(data)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=args.indent, ensure_ascii=False)

    print(f"Transformed {args.input} -> {args.output}")


if __name__ == "__main__":
    main()
