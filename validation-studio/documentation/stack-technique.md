# Stack Technique - Validation Studio

Ce document recense les technologies, bibliothèques et outils utilisés dans le projet **Validation Studio**.

## 1. Cœur du Framework & Langage

| Technologie | Version | Usage |
|-------------|---------|-------|
| **Next.js** | 16.1.6  | Framework React principal (App Router). Gestion du routing, SSR/CSR et API routes. |
| **React**   | 19.2.3  | Bibliothèque UI fondamentale. |
| **TypeScript**| 5.x   | Superset JavaScript pour le typage statique strict. |
| **Node.js** | 20.x    | Environnement d'exécution (via `@types/node`). |

## 2. Interface Utilisateur (UI) & Styling

| Technologie | Usage |
|-------------|-------|
| **Tailwind CSS** (v4) | Framework CSS utilitaire pour le styling rapide et responsive. |
| **Shadcn/ui** | Collection de composants réutilisables basés sur Radix UI et Tailwind. |
| **Radix UI** | Primitives UI accessibles et non stylées (Dialog, Tabs, Slot, etc.). |
| **Lucide React** | Bibliothèque d'icônes vectorielles standardisée. |
| **Monaco Editor** | Éditeur de code embarqué (similaire à VS Code) pour l'édition de JSON/Code. |
| **Sonner** | Gestion des notifications toast. |
| **CMDK** | Interface de type "Command Palette". |
| **Lucide React** | Bibliothèque d'icônes standardisée (Book, Database, Cpu). |
| **Class Variance Authority (CVA)** | Gestion des variantes de styles pour les composants. |
| **clsx / tailwind-merge** | Utilitaires pour la fusion conditionnelle et propre des classes CSS. |

## 3. Gestion d'État & Formulaires

| Technologie | Usage |
|-------------|-------|
| **React Hook Form** | Gestion performante des formulaires. |
| **Zod** | Validation de schéma (notamment pour les formulaires et les données API). |
| **@hookform/resolvers** | Intégration de Zod avec React Hook Form. |
| **js-cookie** | Gestion de la persistance locale (cookies) pour la configuration utilisateur. |
| **Hooks Personnalisés** | `useValidationRunner`, `useEvaluationRunner` pour l'orchestration des processus. |

## 4. Backend & Intégrations API

Bien que "Frontend", l'application Next.js gère des routes API et des intégrations serveurs.

| Technologie | Usage |
|-------------|-------|
| **Axios** | Client HTTP pour les requêtes vers le backend Python ou services externes. |
| **OpenAI SDK** | Client pour l'interaction avec les modèles LLM. |
| **Qdrant Client** | Client REST pour la base de données vectorielle Qdrant. |
| **NDJSON Streaming** | Protocole utilisé pour le streaming des résultats de validation en temps réel. |

## 5. Outils de Développement & Qualité

| Technologie | Usage |
|-------------|-------|
| **ESLint** (v9) | Linter pour garantir la qualité et la cohérence du code. |
| **Prettier** | Formattage du code (impliqué/standard). |
| **Mermaid** | Diagrammes dans la documentation (Architecture). |

## 6. Architecture Technique

### Structure du Projet
- **App Router**: Utilisation du dossier `src/app` pour le routing basé sur le système de fichiers.
- **Server Actions / API Routes**: Gestion de la logique serveur via `src/app/api`.
- **Pages de Documentation**: Routage spécifique sous `/docs` pour Qdrant, API et l'Architecture de l'Orchestrateur.
- **Components**: Séparation entre composants UI génériques (`components/ui`) et composants métier spécifiques.

### Flux de Données
- **Streaming**: L'application utilise fortement le streaming de données (NDJSON) pour afficher la progression des validations en temps réel sans bloquer l'interface.
- **Configuration**: Les configurations LLM sont persistées côté serveur pour garantir la cohérence entre les sessions, tandis que l'interface permet une édition en temps réel via des API dédiées.
