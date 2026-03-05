# Dashboard Widgets Documentation

This document explains the architecture and purpose of the Widget system within the Bill Validation Studio Dashboard.

## 1. The Default Panel

The **Default Panel** (`default-panel.tsx`) is the foundation of the Dashboard. 
- It provides a high-level overview of Precision and Recall across all modules and runs.
- **It cannot be deleted.** It serves as the permanent anchor point for global observability.

From the Default Panel, users can add custom Widgets to drill down into specific areas of interest and track progress over time.

## 2. Widget Types & Objectives

Bill Validation Studio validates parsed events (as JSON) across 7 specific structural modules. The primary goal of the evaluation system is to maximize **Precision** (minimizing hallucinations/false positives) and **Recall** (maximizing the identification of true errors).

The custom widgets are designed to visualize these metrics in different ways:

### Histogram
- **Objective:** Compare error volumes and metrics across different modules or categories within a single timeframe or batch of runs.
- **Use Case:** Quickly spotting which of the 7 modules is currently causing the most False Negatives in a specific evaluation run.

### Time Series
- **Objective:** Track the evolution of metrics (like Precision and Recall) over time or across sequential development iterations.
- **Use Case:** Proving that prompt engineering efforts on a specific module are actually improving results without degrading previous performance.

### Main KPI
- **Objective:** Display headline metrics at a glance.
- **Use Case:** A quick sanity check showing the absolute global Precision and Recall for the most recent production validation batch.

### Breakdown Table
- **Objective:** Provide a detailed, tabular view of True Positives (TP), False Positives (FP), and False Negatives (FN).
- **Use Case:** When a high-level chart shows a drop in Precision, the Breakdown Table allows the user to see exactly which module is generating the unexpected False Positives.

### Distribution
- **Objective:** Visualize the overall impact and show the proportional share of issues.
- **Format:** It takes the form of a pie chart.
- **Use Case 1 (Modules):** A pie chart showing that 60% of all current parsing errors belong to the `PriceGroups` module, helping prioritize developer focus.
- **Use Case 2 (Perturbation Types):** Analyze Precision and Recall by perturbation type (id, string, int, date, float) to get a different level of granularity than what we get from modules. It will let us see at a glance whether, for example, most of our current parsing errors are related to the “string” type or the “date” type, which helps prioritize development efforts.

### Score Heatmap
- **Objective:** A color-coded grid mapping modules against specific evaluation runs or error types.
- **Use Case:** Instantly identifying systemic failures (e.g., a specific run where multiple modules turned "red" simultaneously due to an API change).

---

## 3. Widget Workflows

The Widget system is built to support the iterative nature of LLM prompt engineering. Below are concrete examples of how each widget type is intended to be used in practice.

---

### Time Series: Tracking Iterative Improvements
*The primary tool for proving that prompt engineering is working over time.*

**Step 1: Initial Baseline**
1. Click **Create new Widget**.
2. Select **Time Series** and name it `EventDates_Progress`.
3. Filter to the `EventDates` module.
4. Select the current batch of baseline evaluation runs and choose metrics (Precision & Recall).
5. **Result:** A widget displaying a single data point representing the baseline metrics for `EventDates`.

**Step 2: Iteration & Logging the New State**
1. Iterate on the LLM prompt or parsing logic to fix `EventDates` issues.
2. Run a new batch of evaluations.
3. Open the `EventDates_Progress` widget and click **"Create new state"**.
4. Select the new evaluation runs.
5. **Result:** A **second data point** appears, visualizing the delta from the baseline.
6. Attach a **Note** (e.g., *"Added few-shot examples for ambiguous European dates"*).

---

### Histogram: Cross-Module Comparison
*The tool for finding the weakest link in a specific evaluation run.*

**Step 1: Identifying the Bottleneck**
1. Click **Create new Widget**.
2. Select **Histogram** and name it `Latest_Run_Bottlenecks`.
3. Select the most recent evaluation run.
4. Group by `Module` and select the `False Negatives (FN)` metric.
5. **Result:** A bar chart showing the raw volume of missed errors for each of the 7 modules side-by-side.

**Step 2: Taking Action**
1. Observe which bar is the tallest (e.g., `PriceGroups` has 150 FNs).
2. The team knows to prioritize prompt improvements for `PriceGroups` in the next sprint.

---

### Main KPI: Executive Overview
*The tool for high-level health monitoring.*

**Step 1: Setting up the Snapshot**
1. Click **Create new Widget**.
2. Select **Main KPI** and name it `Global Quality Score`.
3. Do not apply any module filters (compute across all 7 modules).
4. Select the 3 most recent production evaluation runs.
5. **Result:** A widget showing giant, bold numbers for aggregate Precision (e.g., `88.5%`) and Recall (e.g., `92.1%`).

**Step 2: Daily Check-in**
1. Review this widget daily or before any major deployment to ensure no catastrophic regressions have occurred globally.

---

### Breakdown Table: Deep Dive Analysis
*The tool for investigating unexpected drops in high-level metrics.*

**Step 1: Investigating a Regression**
1. The *Main KPI* widget shows Global Precision dropped from 88% to 75%.
2. Click **Create new Widget**.
3. Select **Breakdown Table** and name it `Regression_Investigation`.
4. Select the problematic evaluation run.
5. **Result:** A data table listing `TP`, `FP`, and `FN` counts for every module.

**Step 2: Root Cause Identification**
1. Sort the table by the `FP` column descending.
2. Discover that the `OwnerPOS` module generated 400 new False Positives in this run. Focus debugging efforts specifically on the `OwnerPOS` schema.

---

### Distribution: Error Share Visualization
*The tool for understanding the composition of the error backlog.*

**Step 1: Visualizing the Backlog**
1. Click **Create new Widget**.
2. Select **Distribution** and name it `FP_Distribution`.
3. Select the metric `False Positives (FP)`.
4. Select all evaluation runs from the current week.
5. **Result:** A Pie chart divided into 7 slices (one for each module).

**Step 2: Resource Allocation**
1. Hover over the slices. Observe that `FeeDefinitions` makes up 65% of all False Positives this week.
2. Allocate more engineering resources to the `FeeDefinitions` parsing logic.

---

### Distribution: Impact by Perturbation Type
*The tool for visualizing the overall impact and getting a different level of granularity than what we get from modules.*

**Step 1: Analyzing by Perturbation Type**
1. Click **Create new Widget**.
2. Select **Distribution** and name it `Perturbation_Impact`.
3. Set the configuration to analyze Precision and Recall by perturbation type (id, string, int, date, float).
4. **Result:** A pie chart showing the proportional share of issues for each data type.

**Step 2: Prioritizing Development**
1. Review the chart to see at a glance the distribution of errors.
2. If most current parsing errors are related to the "string" type or the "date" type, prioritize development efforts specifically for those data types.

---

### Score Heatmap: Systemic Failure Detection
*The tool for spotting cross-cutting regressions across time.*

**Step 1: Creating the Matrix**
1. Click **Create new Widget**.
2. Select **Score Heatmap** and name it `Module_Health_Matrix`.
3. Set the Y-axis to `Modules` (all 7).
4. Set the X-axis to `Evaluation Runs` (the last 10 runs).
5. Set the color metric to `Precision`.
6. **Result:** A grid of 70 colored squares (green for high precision, red for low).

**Step 2: Spotting Systemic Issues**
1. Look for patterns in the colors.
2. If an entire *row* is red, a specific module is historically problematic.
3. If an entire *column* is red, a specific evaluation run was catastrophically bad across the board (e.g., a bad model update or a broken test dataset).
