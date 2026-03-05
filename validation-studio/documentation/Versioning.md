# Versioning & Changelog

This document tracks the version history of **Validation Studio** and the planned roadmap.

We adhere to [Semantic Versioning](https://semver.org/) (Major.Minor.Patch) to maintain consistency across our architectural compartments and UI components.

---

## 🚀 Active Roadmap

### **v0.2.x — Stability & Polish** (Current)
**Released:** 17/02/2026  
**Primary Focus:** Architectural decoupling and model robustness.
- [x] **Modular Backend:** 6-Compartment architecture (API, Build, LLM, Storage, RAG, Orchestrator).
- [x] **Robustness Testing:** Prompt Slicing and Domain Rules integration.
- [x] **UX Polish:** Interactive details dialog and Home Page search.

### **v0.3.0 — High-Level Insights** (In Progress)
**Status:** 🚧 In Progress  
**Primary Focus:** Aggregated analytics and dashboarding.
- `[ADDED]` **Dashboard Page:** Precision & recall panel (`default-panel`) with date filter, run selector, global metrics, and per-module breakdown.
- **Analytics:** Common issue analysis and performance trends over time.

---

## 📜 Full Release History

### **v0.2.4** (24/02/2026)
> [!NOTE]
> Enhancements to user experience, configuration, feedback loops, and validation progress tracking.

- `[ADDED]` **Get Feedback Feature:** Added a comprehensive LLM feedback generation feature to help users evaluate and improve their validation outputs.
- `[ADDED]` **Reasoning Level Configuration:** Added configuration options (Low, Medium, High) for the LLM's reasoning effort, updating default values for different parameters.
- `[ADDED]` **Evaluation & Observability History Filters:** Implemented advanced history filtering capabilities based on date, status, event name, and event ID.
- `[IMPROVED]` **Reasoning Panel Navigation:** The reasoning panel now automatically scrolls to the relevant section when a specific issue is clicked, improving traceability.
- `[IMPROVED]` **Validation Progress UI:** Enhanced the execution UI with dynamic elapsed time tracking and precise estimated time (ETA) calculations using global sub-prompt metrics.

### **v0.2.3** (24/02/2026)
> [!NOTE]
> Major refactor for modularity and introduction of Reasoning visualization.

- `[ADDED]` **Reasoning Storage & Display:** Introduced the `ReasoningViewer` and updated storage schemas to support "Chain of Thought" data. Users can now view the LLM's logical steps alongside the results in both Observability and Evaluation detail views.
- `[IMPROVED]` **Perturbation Visualization:** Fixed the prompt panel in Evaluation Details to manually apply recorded perturbations to the display text, providing an authentic view of the exactly manipulated prompt sent to the model.
- `[REFACTOR]` **Hook & Component Modularity:** Decomposed monolithic files (`useEvaluationRunner.ts`, `EvaluationDetailsDialog.tsx`) into a modular structure under `src/hooks/evaluation/` and `src/components/evaluation/details/`, significantly improving code maintainability.

### **v0.2.2** (20/02/2026)
> [!NOTE]
> Major code consolidation and UI layout optimization for validation details.

- `[IMPROVED]` **Code Centralization:** Rigorous refactor of `EvaluationDetailsDialog` and `ObservabilityDetailsDialog` using shared hooks (`usePromptManager`) and components (`PromptViewer`, `DialogLayout`) for a unified validation pipeline.
- `[CHANGED]` **Prompt Visibility:** Decoupled LLM submission from UI rendering; the interface now displays the full original prompt before slicing to provide better context, while internal logic still handles granular sub-prompt execution.
- `[IMPROVED]` **UI Layout & UX:** Relocated module navigation to a global top bar, expanded result panels (55% width) for better data density, and fixed scrollbar boundaries in the prompt viewer for smoother navigation.

### **v0.2.1** (18/02/2026)
> [!NOTE]
> Focus on UI/UX synchronization and data rendering accuracy.

- `[IMPROVED]` **Interactive Details View:** Added click-to-scroll navigation from issue reports directly to the relevant prompt segment or perturbation tracking (TP-sync).
- `[FIXED]` **Prompt Rendering:** Corrected observability view to display the raw `.content` (CSV/Prompt) instead of serialized JSON metadata.
- `[IMPROVED]` **UI Robustness:** Added defensive checks for undefined metadata and improved hover feedback on interactive elements.

### **v0.2.0** (17/02/2026)
> [!IMPORTANT]
> Major architectural overhaul and robustness features.

- `[ADDED]` **6-Compartment Backend:** Complete reorganization of the system for maintainability and horizontal scaling.
- `[ADDED]` **Prompt Length Slicing:** New hyperparameter to test partial prompts (100%, 50%, 33%) to optimize context window and robustness.
- `[ADDED]` **Domain Rules Integration:** Automated injection of rules from `description_donnee.md` into the prompt pipeline.
- `[IMPROVED]` **Observability Dialog:** Completely redesigned "View Details" experience for better transparency.
- `[ADDED]` **Search Events:** Powerful search bar on the home page for instant event selection.

### **v0.1.0** (11/02/2026)
- `[ADDED]` **Core Foundations:** Initial release of Observability and Evaluation tabs.
- `[ADDED]` **Perturbation Engine:** Basic support for Case, Typos, and Whitespace testing.
- `[ADDED]` **LLM Integration:** Core pipeline for sending prompts to LLMs with tool-call parsing.

---

> [!TIP]
> For detailed technical specifications of the current version, refer to the [Backend Architecture](file:///home/maxencetlm/Bill-LLM-EndVal/validation-studio/Architecture/backend/backend-architecture.md).
