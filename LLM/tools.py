SYSTEM_MESSAGE_FR = """
Tu es un assistant expert en validation de configurations d'événements de billetterie.
Ton rôle est d'exécuter une vérification précise sur un événement CIBLE en le comparant à des événements SIMILAIRES de référence.

Règles:
- UTILISE les données des événements similaires fournies pour la comparaison.
- Tu DOIS utiliser l'outil `report_step_issues` pour donner ta réponse.
- Si des anomalies sont détectées : liste-les avec précision (chemin, sévérité, message explicatif).
- Si AUCUNE anomalie n'est détectée : appelle `report_step_issues` avec une liste `issues` vide [].
- Ne fournis jamais de texte ou de commentaires en dehors de l'appel à l'outil.
""".strip()


PROMPT_FORMAT_PATHS_TEMPLATE_FR = """
Tu es un assistant qui aide à identifier les chemins (paths) pertinents dans une structure de données JSON complexe.

Description de ce que nous cherchons à identifier :
---
{description}
---

Voici la liste des chemins (paths) disponibles dans la structure de données JSON.
Tu ne dois choisir que parmi ces chemins, sans en inventer de nouveaux :
---
{paths_list}
---

Ta tâche :
- Sélectionner UNIQUEMENT les chemins qui correspondent le mieux à la description fournie.
- Tu peux en choisir plusieurs, un seul, ou aucun.
- Si aucun chemin ne correspond, tu dois renvoyer une liste vide.

IMPORTANT :
- Tu DOIS appeler la fonction `format_paths` pour renvoyer la liste finale des chemins sélectionnés.
- Ne renvoie pas de texte libre, n'explique pas ton raisonnement : utilise seulement `format_paths`.
""".strip()

VALIDATE_SECTION_PROMPT_FR = """
CONTEXTE:
{policy_intro}

POINT À VÉRIFIER ({check_num}/{total_checks}): "{check_name}"

INSTRUCTIONS SPÉCIFIQUES:
{instruction}

--------------------------------------------------
DONNÉES DE L'ÉVÉNEMENT CIBLE (ID: {cible_id})
--------------------------------------------------
{target_content}

--------------------------------------------------
DONNÉES DES ÉVÉNEMENTS SIMILAIRES (RÉFÉRENCES)
--------------------------------------------------
{similar_content}

--------------------------------------------------

TACHE :
Si tu détectes des anomalies, utilise l'outil `report_step_issues` pour les signaler.
Si tout est correct, appelle `report_step_issues` avec une liste vide.
""".strip()



VALIDATE_SECTION_SPEC_PROMPT_FR = """
CONTEXTE:

Élément à valider ({element_num}/{total_elements}):

{policy_intro}

--------------------------------------------------
DONNÉES DE L'ÉVÉNEMENT CIBLE (ID: {cible_id})
--------------------------------------------------
{data_element}

--------------------------------------------------
DONNÉES DES ÉVÉNEMENTS SIMILAIRES (RÉFÉRENCES)
--------------------------------------------------
PAS DE DONNÉES SIMILAIRES POUR CE MODULE

--------------------------------------------------

TACHE :
Si tu détectes des anomalies, utilise l'outil `report_step_issues` pour les signaler.
Si tout est correct, appelle `report_step_issues` avec une liste vide.
""".strip()

tool_report_step_issues = {
    "type": "function",
    "function": {
        "name": "report_step_issues",
        "description": (
            "Rapporte le résultat de l'analyse pour l'étape de vérification en cours. "
            "Doit être appelé même si aucune anomalie n'est trouvée (avec une liste vide)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "issues": {
                    "type": "array",
                    "description": "Liste des anomalies détectées. Laisser vide [] si tout est correct.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Chemin ou nom du champ concerné (ex: 'Event.NameFR')."
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["error", "warning", "info"],
                                "description": "Utiliser 'error' pour une faute bloquante/évidente, 'warning' pour une incohérence suspecte, 'info' pour une observation."
                            },
                            "message": {
                                "type": "string",
                                "description": "Explication courte du problème, mentionnant la différence avec les événements similaires."
                            },
                            "suggestion": {
                                "type": "string",
                                "description": "Action suggérée pour corriger (optionnel)."
                            },
                        },
                        "required": ["path", "severity", "message"],
                    },
                },
            },
            "required": ["issues"],
        },
    },
}


tool_format_paths = {
    "type": "function",
    "function": {
        "name": "format_paths",
        "description": (
            "Sélectionne et renvoie la liste finale des chemins (paths) pertinents "
            "parmi ceux proposés."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "description": "Liste des chemins sélectionnés comme pertinents.",
                    "items": {
                        "type": "string",
                    },
                }
            },
            "required": ["paths"],
        },
    },
}



TOOLS_VALIDATOR_FR: list = [
    tool_report_step_issues
]

TOOLS_PROVIDER_FR: list = [
    tool_format_paths,
]

# For backwards compatibility
SYSTEM_MESSAGE = SYSTEM_MESSAGE_FR
PROMPT_FORMAT_PATHS_TEMPLATE = PROMPT_FORMAT_PATHS_TEMPLATE_FR
TOOLS_VALIDATOR = TOOLS_VALIDATOR_FR
TOOLS_PROVIDER = TOOLS_PROVIDER_FR
