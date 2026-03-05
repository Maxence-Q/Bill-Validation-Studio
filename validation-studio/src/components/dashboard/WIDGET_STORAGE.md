# Widget Storage Strategy & Schema Design

This document outlines how we store the configuration and historical data of the Dashboard Widgets within the `validation-studio/data` folder.

## Storage Strategy: JSON over SQLite

Given the local, professional-oriented nature of the Validation Studio, we use a dedicated **`widgets/` folder containing individual JSON files for each widget** instead of a single merged JSON file or a SQLite database. 

**Why JSON?**
- **Flexibility:** Widgets have highly variable, nested configurations based on their type. JSON handles this natively without strict migrations.
- **Portability & Versioning:** JSON files are easily readable, version-controllable (via Git), and simple to share across instances.
- **Simplicity:** For typical dashboard usage (tens to hundreds of widgets), loading JSON into memory is fast and avoids the overhead of managing local database connections and schemas.

---

## JSON Storage Architecture: Definition vs Snapshot

Each widget's JSON file is split into two top-level concerns:

| Concept | Stored when | What it contains | Mutability |
|---|---|---|---|
| **Definition** | On creation | The query/config — *what the user asks for* (modules, metrics, groupBy, run selection, aggregation, etc.) | Editable by the user at any time |
| **Snapshot** | On use ("Create new state" / refresh) | The computed result — *what was actually measured* (metric values, raw counters, deltas, notes) | Immutable once created (append-only history) |

**Why this matters:**
- Widgets are described as time-tracking tools ("Create new state", etc.). Storing snapshots as **first-class objects** makes history, rollback, comparison, and caching straightforward.
- The Definition is the "question"; the Snapshot is the "answer at a point in time". Separating them means we can re-run a Definition against new data without losing past answers.

### File structure

```
validation-studio/data/widgets/
├── default-panel.json          # Reserved — the Default Panel (cannot be deleted)
├── <widget-uuid-1>.json        # One file per custom widget
├── <widget-uuid-2>.json
└── ...
```

> **Default Panel:** The Default Panel is stored under the reserved name `default-panel.json`. The read/write layer must protect this file from deletion. It provides the permanent, global overview of Precision and Recall across all modules and runs.

Each `.json` file follows this top-level shape:

```json
{
  "id": "uuid",
  "type": "time_series",
  "definition": {
    "query": { ... },
    ...type-specific fields
  },
  "snapshots": [ ... ]
}
```

---

## Schema Design

Within each widget, the **Definition** and **Snapshot** sections are further separated into **Crucial/Vital** parameters (required for rendering and computing) and **Nice-to-have/Potential** parameters (UI states, display options, annotations).

---

### 1. Base Widget (Shared Properties)
All widgets, regardless of their type, share these core properties at the top level of their JSON file.

**Crucial / Vital:**
- `id` (string): Unique identifier (UUID).
- `type` (enum): The widget type (`time_series`, `histogram`, `distribution`, `main_kpi`, `breakdown_table`, `score_heatmap`).
- `name` (string): Display name of the widget.
- `createdAt` (string): ISO 8601 date string — when the widget was first created.
- `updatedAt` (string): ISO 8601 date string — when the definition was last modified.
- `isRemovable` (boolean): Whether this widget can be deleted by the user. Defaults to `true`. Set to `false` for the Default Panel so the UI hides the delete button.

**Nice-to-have / Potential:**
- `description` (string): Optional context or note about what the widget tracks.
- `author` (string): Identifier of the user who created it (useful if shared).
- `layout` (object): Dashboard grid coordinates `{ x: number, y: number, w: number, h: number }`.

---

### 2. Shared Query DSL

To avoid each widget type reinventing its own filters, **every widget's `definition` embeds a standardized `query` block**. This is the single source of truth for "what data does this widget look at".

```json
{
  "query": {
    "runSelection": {
      "type": "ids",
      "runBatchIds": ["run-42", "run-43"]
    },
    "scope": {
      "modules": ["EventDates", "PriceGroups"],
      "perturbationTypes": []
    },
    "metrics": ["precision", "recall"],
    "groupBy": null,
    "aggregation": null
  }
}
```

| Field | Type | Purpose |
|---|---|---|
| `runSelection` | object | How runs are selected. `{ type: "ids", runBatchIds: [...] }` or `{ type: "latest", count: 3 }` or `{ type: "dateRange", start, end }`. |
| `scope.modules` | string[] | Which modules to include (empty = all). |
| `scope.perturbationTypes` | string[] | Which perturbation types to include (empty = all). |
| `metrics` | string[] | Metrics to compute (`precision`, `recall`, `f1`, `false_positives`, `false_negatives`, etc.). |
| `groupBy` | enum \| null | Breakdown dimension (`module`, `perturbation_type`, or `null` for aggregate). |
| `aggregation` | enum \| null | How to combine multi-run data (`sum`, `avg`, `median`, `weighted_by_events`, or `null`). |

**Why this matters:**
- Adding a new filter dimension later (by model, by dataset, by severity…) means adding one field to `query` — not updating six different widget schemas.
- The `query` block can be validated, serialized, and compared independently of the widget type.
- Each widget type then only adds its own **type-specific shape** on top of the shared query.

---

### 3. Time Series
*Tracks iterative improvements over time.*

#### Definition (on creation)
*Inherits the shared `query` block. Type-specific extras:*

**Crucial / Vital:**
- `query` (object): Shared Query DSL (see above). Typically: `scope` sets the modules, `metrics` sets precision/recall, and `runSelection` is set per-snapshot rather than globally.

**Nice-to-have / Potential:**
- `targetThreshold` (number): A predefined goal line drawn on the chart (e.g., `0.95`).

#### Snapshots (on use — "Create new state")
*Each snapshot is a first-class object appended to the `snapshots` array each time the user creates a new data point. The snapshot captures the run selection used for this specific point.*

**Crucial / Vital:**
- `snapshotId` (string): Unique identifier for this snapshot.
- `createdAt` (string): ISO 8601 date string — when this data point was created.
- `runSelection` (object): The specific run selection used for this point (overrides the definition-level query if needed), e.g., `{ type: "ids", runBatchIds: ["run-44", "run-45"] }`.
- `metricsComputed` (object): Snapshot of the computed metrics (e.g., `{ precision: 0.88, recall: 0.90 }`).
- `rawCounters` (object): Snapshot of the underlying counters (e.g., `{ TP: 150, FP: 10, FN: 25 }`) to explain past metrics if formulas change.

**Nice-to-have / Potential:**
- `note` (string): What was worked on/upgraded (e.g., "Added 5 few-shot examples for dates").
- `progressSinceLast` (object): Pre-calculated delta showing progress/regression relative to the previous snapshot (e.g., `{ precision: "+0.03" }`).

---

### 4. Histogram
*Cross-module comparisons in a specific run or period.*

#### Definition (on creation)
*Inherits the shared `query` block. The `groupBy` field is **required** for histograms.*

**Crucial / Vital:**
- `query` (object): Shared Query DSL. `runSelection` sets the batch(es), `metrics` typically targets a single metric (e.g., `["false_negatives"]`), `groupBy` is required (`module` or `perturbation_type`), and `aggregation` specifies how multi-run data combines.

**Nice-to-have / Potential:**
- `sortBy` (enum): Output ordering (`value_desc`, `value_asc`, `alphabetical`).
- `colorScale` (string): Hex code or predefined palette ID.

#### Snapshots (on use)
*Computed each time the widget is refreshed or a new state is created.*

**Crucial / Vital:**
- `snapshotId` (string)
- `createdAt` (string)
- `bars` (array): Each bar's computed value, e.g., `[{ category: "PriceGroups", value: 150 }, ...]`.
- `rawCounters` (object): Per-category TP/FP/FN counters.

**Nice-to-have / Potential:**
- `note` (string): Context for this specific snapshot.

---

### 5. Distribution (Pie Chart)
*Understanding the composition of an error backlog.*

#### Definition (on creation)
*Inherits the shared `query` block. The `groupBy` field drives the pie slices.*

**Crucial / Vital:**
- `query` (object): Shared Query DSL. `runSelection` sets the runs, `metrics` typically targets a single metric (e.g., `["false_positives"]`), and `groupBy` defines the slice dimension (`module` or `perturbation_type`).

**Nice-to-have / Potential:**
- `minSlicePercent` (number): Threshold to standardise an "Others" category automatically for tiny slices.
- `excludeCategories` (string[]): Specific categories to hide from the pie chart (e.g., `['Others']`).
- `showLegend` (boolean): Whether to display the visual legend.

#### Snapshots (on use)

**Crucial / Vital:**
- `snapshotId` (string)
- `createdAt` (string)
- `slices` (array): Each slice's computed share, e.g., `[{ category: "PriceGroups", value: 85, percent: 0.60 }, ...]`.
- `rawCounters` (object): Per-category TP/FP/FN counters.

**Nice-to-have / Potential:**
- `note` (string)

---

### 6. Main KPI
*High-level health monitoring and executive summaries.*

#### Definition (on creation)
*Inherits the shared `query` block. Typically `groupBy` is `null` (aggregate across everything) and `aggregation` is explicitly set.*

**Crucial / Vital:**
- `query` (object): Shared Query DSL. `runSelection` sets the runs, `metrics` sets what to display, `aggregation` is required (e.g., `average`, `weighted_by_events`).

**Nice-to-have / Potential:**
- `compareWithRunBatchId` (string): A baseline run to display a positive/negative delta against.
- `globalThresholdStatus` (boolean): Whether to enforce a strict color status (green/red) on the widget based on overall health.

#### Snapshots (on use)

**Crucial / Vital:**
- `snapshotId` (string)
- `createdAt` (string)
- `metricsComputed` (object): The headline numbers (e.g., `{ precision: 0.885, recall: 0.921 }`).
- `rawCounters` (object): Aggregate TP/FP/FN behind the metrics.

**Nice-to-have / Potential:**
- `deltaFromBaseline` (object): Pre-calculated comparison delta (e.g., `{ precision: "+0.05" }`).
- `note` (string)

---

### 7. Breakdown Table
*Deep dive analysis into TP, FP, FN.*

#### Definition (on creation)
*Inherits the shared `query` block. Typically a single run with optional `groupBy`.*

**Crucial / Vital:**
- `query` (object): Shared Query DSL. `runSelection` targets a single run, `groupBy` optionally sets the breakdown axis (`module`, `perturbation_type`).

**Nice-to-have / Potential:**
- `hiddenColumns` (string[]): List of column keys the user has folded away.
- `defaultSort` (object): The active sorting parameter `{ column: 'FP', direction: 'desc' }`.

#### Snapshots (on use)

**Crucial / Vital:**
- `snapshotId` (string)
- `createdAt` (string)
- `rows` (array): Each row's computed data, e.g., `[{ module: "PriceGroups", TP: 120, FP: 15, FN: 30 }, ...]`.

**Nice-to-have / Potential:**
- `note` (string)

---

### 8. Score Heatmap
*Spotting cross-cutting regressions across time.*

#### Definition (on creation)
*Inherits the shared `query` block. This widget has the most type-specific configuration since it maps two dimensions into a grid.*

**Crucial / Vital:**
- `query` (object): Shared Query DSL. `metrics` typically holds a single metric (e.g., `["precision"]`), `scope` defines which modules/perturbation types populate the Y-axis rows.
- `yAxis` (enum): Dimension for rows (`modules`, `perturbation_types`).
- `xAxis` (object): Dimension for columns (e.g., `{ type: "runs", runIds: [...] }` or `{ type: "time", start: "2026-02-01", end: "2026-02-28", bucket: "week" }`).
- `cellAggregation` (enum): Value mapping for each cell if data spans multiple items (`average`, `min`, `last_value`).

**Nice-to-have / Potential:**
- `colorThresholds` (object): Custom bounds for colors (e.g., `{ red: '< 0.7', yellow: '0.7-0.9', green: '> 0.9' }`).

#### Snapshots (on use)

**Crucial / Vital:**
- `snapshotId` (string)
- `createdAt` (string)
- `cells` (array): Each cell's computed value, e.g., `[{ row: "PriceGroups", col: "run-42", value: 0.72 }, ...]`.

**Nice-to-have / Potential:**
- `note` (string)
