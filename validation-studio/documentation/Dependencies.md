# Dependencies

A breakdown of every external library used in the project and why.

---

## Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | React meta-framework — handles routing (App Router), SSR, API routes, bundling |
| `react` | 19.2.3 | UI rendering library |
| `react-dom` | 19.2.3 | React DOM bindings for browser rendering |

---

## UI Component Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| `radix-ui` | 1.4.3 | Headless, accessible UI primitives (dialogs, dropdowns, tooltips, etc.) |
| `@radix-ui/react-tabs` | 1.1.13 | Standalone Radix Tabs component used for tab navigation |
| `@radix-ui/react-checkbox` | 1.3.3 | Accessible checkbox primitive |
| `lucide-react` | 0.563.0 | Icon library — provides all SVG icons used across the app (e.g. `Book`, `Database`, `Cpu`) |
| `sonner` | 2.0.7 | Toast notification system — lightweight, animated toasts |
| `cmdk` | 1.1.1 | Command palette component |

---

## Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | 4.x | Utility-first CSS framework — all styling is done via Tailwind classes |
| `@tailwindcss/postcss` | 4.x | PostCSS plugin to process Tailwind in the build pipeline |
| `@tailwindcss/typography` | 0.5.19 | Plugin to style raw markdown/HTML content |
| `tailwind-merge` | 3.4.0 | Intelligently merges conflicting Tailwind classes (used in the `cn()` utility) |
| `class-variance-authority` | 0.7.1 | Manages component style variants (e.g. `Button` with `variant="ghost"`, `size="sm"`) |
| `clsx` | 2.1.1 | Conditional class name concatenation — used inside `cn()` |
| `tw-animate-css` | 1.4.0 | Tailwind animation utilities (`animate-in`, `fade-in`, etc.) |

---

## Forms & Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | 7.71.1 | Performant form state management with minimal re-renders |
| `@hookform/resolvers` | 5.2.2 | Connects `react-hook-form` to schema validators like Zod |
| `zod` | 4.3.6 | Schema declaration & validation — validates configuration forms, API payloads |

---

## AI / LLM Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `openai` | 6.21.0 | Official OpenAI SDK — used to call GPT models for event validation and evaluation |

---

## Data & Storage

| Package | Version | Purpose |
|---------|---------|---------|
| `js-cookie` | 3.0.5 | Client-side cookie read/write — stores LLM configurations in browser cookies |
| `uuid` | 13.0.0 | Generates unique IDs (v4) for validation/evaluation records |
| `@qdrant/js-client-rest` | 1.16.2 | Qdrant vector database client — used for vector search / embeddings storage |

---

## HTTP & File Handling

| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | 1.13.5 | HTTP client — used for external API calls alongside the native `fetch` |
| `react-dropzone` | 15.0.0 | Drag-and-drop file upload component — used for JSON file uploads |
| `react-markdown` | 10.1.0 | Renders markdown as React components |
| `remark-gfm` | 4.0.1 | Support for GitHub Flavored Markdown (tables, tasklists) |

---

## Editor

| Package | Version | Purpose |
|---------|---------|---------|
| `@monaco-editor/react` | 4.7.0 | VS Code editor embedded in the browser — used for viewing/editing JSON and prompts |

---

## Theming

| Package | Version | Purpose |
|---------|---------|---------|
| `next-themes` | 0.4.6 | Dark/light mode toggle with system preference detection, works with Next.js SSR |

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.x | TypeScript compiler — the entire codebase is written in TypeScript |
| `@types/node` | 20.x | Type definitions for Node.js APIs |
| `@types/react` | 19.x | Type definitions for React |
| `@types/react-dom` | 19.x | Type definitions for React DOM |
| `@types/js-cookie` | 3.0.6 | Type definitions for `js-cookie` |
| `@types/uuid` | 10.0.0 | Type definitions for `uuid` |
| `eslint` | 9.x | JavaScript/TypeScript linter |
| `eslint-config-next` | 16.1.6 | ESLint rules tailored for Next.js projects |
| `shadcn` | 3.8.4 | CLI tool to scaffold and add shadcn/ui components (Dialog, Button, Card, Table, etc.) |
