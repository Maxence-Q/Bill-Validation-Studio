# Versioning & Changelog

This document tracks the version history of the **Validation Studio** and the planned features for upcoming releases.

We follow a [Semantic Versioning](https://semver.org/) approach (Major.Minor.Patch), although for now, we are in the `0.x` phase where rapid development occurs.

---

## **v0.1.0** (Current)
**Status:** Released  
**Focus:** Core Validation & Evaluation Foundation

- **Observability Tab:**
  - Full history of validation runs.
  - View details of past runs (prompts, issues, perturbations).
  - Delete records.
- **Evaluation Tab:**
  - Create new evaluations from previous observability runs or uploaded JSON.
  - Configuration of LLM parameters (Model, Temperature).
  - Perturbation testing (Typos, Case, Whitespace).
  - **Evaluation History:** storage and visualization of past evaluation results.
- **Home Page:**
  - Basic navigation to Observability and Evaluation.

---

## **v0.1.1** (Planned)
**Status:** In Progress  
**Focus:** Enhanced User Experience & Fine-grained Control

- **Home Page Search:**
  - Add specific search bar to find events by name/ID quickly.
- **Advanced Configuration:**
  - **Prompt Length Slicing:** New hyperparameter to test partial prompts (e.g., 100%, 50%, 33% of attributes) to verify robustness against missing context.
- **Evaluation Improvements:**
  - Refined "View Details" experience.

---

## **v0.1.2** (Planned)
**Status:** Next  
**Focus:** High-Level Insights

- **Dashboard Tab:**
  - Global metrics visualization.
  - Success/Failure rates over time.
  - Common issue types analysis.
  - Aggregated performance stats.
