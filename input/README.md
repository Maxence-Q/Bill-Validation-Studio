# json-structure-for-bob

Transforms Reservatech ticketing system JSON exports into a clean, LLM-friendly structure optimized for understanding and cross-event comparison.

## What it does

- Removes internal IDs, GL accounting references, audit fields, printer commands, and UI state
- Replaces opaque foreign keys with structural nesting and named references
- Replaces computed tax dollar amounts with tax applicability labels (TPS/TVQ)
- Strips null values, empty strings, and duplicated data (timezone, membership blocks)
- Preserves bilingual fields as `{"fr": "...", "en": "..."}` objects
- Computes an `_insights` section with derived analytics for cross-event comparison

## Usage

```bash
python main.py -i input/event_1.json -o output/event_1.json
```

### Options

| Flag | Description | Default |
|---|---|---|
| `-i`, `--input` | Input JSON file path (required) | — |
| `-o`, `--output` | Output JSON file path (required) | — |
| `--indent` | JSON indent level | 2 |

## Transformation process

The source JSON from Reservatech is a deeply nested export (~3000 lines) containing a mix of business data, internal system state, and redundant copies of the same entities. The transformer works in three phases:

### 1. Build lookups

Before any transformation, the script scans the raw data to build ID-to-name mappings:

- **Section lookup** — collects all `SectionID` values from `Prices` and maps them to labels (`Section_88921`, etc.)
- **POS lookup** — maps `PointOfSaleID` to human-readable names (`23` → `"Internet"`, `120` → `"Salle André-Mathieu"`) from `RightToSellAndFees`
- **Price group lookup** — maps `PriceGroupID` to group names (`63609` → `"Rég."`) from `PriceGroups`

These lookups allow every subsequent step to replace opaque IDs with meaningful names.

### 2. Transform each domain

Six independent transformers extract and reshape the data:

| Transformer | Source path in raw JSON | What it produces |
|---|---|---|
| `transform_event` | `Event.Event`, `Event.RO_RepresentationType`, `Event.RO_ActivityType` | Event identity, status flags, internet settings, delivery options |
| `transform_venue` | `Event.OwnerPOS`, `Event.Timezone` | Venue name, address, contact, timezone (deduplicated — appears 9x in source) |
| `transform_producer` | `Event.RO_Producer` | Producer name, email, report frequency |
| `transform_performances` | `EventDates.EventDateModelList[]` | Performance dates (local time), sales windows per channel, status |
| `transform_pricing` | `Prices.PriceGroups[]`, `PriceGroups.PriceGroupModelList[]` | Tax definitions, section list, price groups with per-section prices, membership/credit card requirements, allowed channels |
| `transform_sales_channels` | `RightToSellAndFees.RightToSellAndFeesModelList[]` | POS names, fee amounts with tax labels, authorized price groups (resolved from IDs to names) |

Each transformer only reads the fields it needs and discards everything else — IDs, GL accounts, audit metadata, printer commands, UI state, and null/empty values never make it to the output.

### 3. Compute insights

After all transformers run, `compute_insights` operates on the **clean output** (not the raw source) to derive cross-event comparison analytics: price ranges, section tiers, group-vs-baseline ratios, fee impact percentages, and a structural event profile.

### What gets removed

| Category | Examples | Count |
|---|---|---|
| Foreign key IDs | `EventID`, `ProducerID`, `SectionID`, `MembershipTypeID` | ~68 key names |
| GL accounting | `SalesRevenueGLAccountID`, `TaxDue1GLAccountID` | ~33 keys |
| Read-only computed | `RO_FullEventNameFR`, `RO_HasPicture`, `RO_DisplayOrder` | ~46 keys |
| Audit metadata | `CreatedDate`, `CreatedBy`, `UpdatedDate`, `IsDeleted` | 7 keys |
| System internals | `PrintCommands_Boca`, `ShowAddEventDate`, `ReadOnlyItem`, `IDChain` | misc |
| Redundant data | Timezone block (duplicated 9x), membership block (duplicated per group) | deduped |
| Computed tax amounts | `Tax1Amount`, `Tax2Amount`, `FeeTax1`, `FeeTax2` | replaced by `taxes_applied: ["TPS", "TVQ"]` |

Result: **109 KB → 15 KB** (~7x reduction), **3044 lines → 643 lines**.

## Output structure

```
{
  _metadata          — source system and description
  event              — names, artist, genre, activity type, status, delivery settings
  venue              — name, address, contact, timezone, event reminder
  producer           — name, email, report frequency
  performances[]     — dates, sales windows per channel, status
  pricing            — applicable taxes, sections, price groups with per-section prices
  sales_channels[]   — POS name, fees, authorized price groups
  _insights          — computed analytics (see below)
}
```

## Computed insights

The `_insights` section provides derived data to help compare events structurally:

- **pricing_summary** — price range, section tiers, premium-to-standard ratio, paid vs complimentary counts
- **group_comparisons** — each price group as a ratio vs the baseline (e.g. "10% membership discount")
- **fee_impact** — total fees before tax, fees as percentage of cheapest/most expensive ticket
- **sales_channel_summary** — channel names, box-office-only groups
- **event_profile** — structural fingerprint (sections, tiers, performances, genre, city)

## Requirements

- Python >= 3.10
- No external dependencies (stdlib only)
