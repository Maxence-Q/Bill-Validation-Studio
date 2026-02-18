# Versioning & Changelog

This document tracks the version history of the **Validation Studio** and the planned features for upcoming releases.

We follow a [Semantic Versioning](https://semver.org/) approach (Major.Minor.Patch), although for now, we are in the `0.x` phase where rapid development occurs.

---

## **v0.1.0**
**Released:** 11/02/26
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

## **v0.2.0** (Current)
**Released:** 17/02/26
**Focus:** Architectural Overhaul & Robustness Testing

- **Modular Backend Architecture:**
  - Reorganized system into **6 clearly defined compartments** (API, Build Prompts, LLM, Storage, RAG, Orchestrator) for better maintainability and horizontal scaling.
  - Introduced `ValidationOrchestrator` to handle complex multi-step workflows.
  - New `PromptReconstructionService` to accurately rebuild context for historical data.
- **Advanced Configuration & Robustness:**
  - **Prompt Length Slicing:** New hyperparameter to test partial prompts (e.g., 100%, 50%, 33% of attributes) to verify model robustness against missing context and lighten the context window.
  - **Prompt Rules Integration:** Domain-specific rules from `description_donnee.md` are now automatically injected into the prompt building pipeline.
- **User Experience Enhancements:**
  - **Refined "View Details":** Completely redesigned observability details dialog for better transparency of the LLM context.
  - **Home Page Search:** Added a powerful search bar to find and select events by name or ID instantly.
- **Improved Evaluation Engine:**
  - Dedicated Evaluation Run API for cleaner lifecycle management.
  - Synchronous metrics calculation during validation/evaluation runs.

---

## **v0.3.0** (Planned)
**Status:** Next  
**Focus:** High-Level Insights

- **Dashboard Tab:**
  - Global metrics visualization.
  - Success/Failure rates over time.
  - Common issue types analysis.
  - Aggregated performance stats.
