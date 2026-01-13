SYSTEM_MESSAGE = """
Tu es un assistant expert en validation de configurations d'événements de billetterie.
Ton rôle est d'exécuter une vérification précise sur un événement CIBLE en le comparant à des événements SIMILAIRES de référence.

Règles:
- Tu DOIS utiliser l'outil `report_step_issues` pour donner ta réponse.
- Si des anomalies sont détectées : liste-les avec précision (chemin, sévérité, message explicatif).
- Si AUCUNE anomalie n'est détectée : appelle `report_step_issues` avec une liste `issues` vide [].
- Ne fournis jamais de texte ou de commentaires en dehors de l'appel à l'outil.
""".strip()


PROMPT_FORMAT_PATHS_TEMPLATE = """
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


PROMPT_FORMAT_GROUPS_TEMPLATE = """
Tu es un assistant qui aide à matcher les groupes (lignes de données) entre deux événements.

Groupes reçus de l'événement CIBLE :
---
{target_batch}
---

Groupes disponibles dans l'événement SIMILAIRE {sim_event_id} :
---
{sim_event_groups}
---

FORMAT DES GROUPES :
Chaque groupe est une ligne complète au format suivant :
"[Model ID=XXXXX] NameFR='...', Favour=..., Consignment=..., Membership='...', AllowedPOS=[...], ChargeFees1=..., ChargeFees2=..., MinQty=..., MaxQty=..., HideOnStandardInternetSale=..., ..."

Exemple :
"[PriceGroupModel ID=45131] NameFR='Régulier', Favour=False, Consignment=False, Membership='00000000-0000-0000-0000-000000000000', AllowedPOS=[23, 120], ChargeFees1=True, ChargeFees2=False, MinQty=0, MaxQty=0, HideOnStandardInternetSale=False"

Ta tâche :
- POUR CHAQUE GROUPE reçu de l'événement CIBLE, trouver le groupe LE PLUS SIMILAIRE dans l'événement similaire.
- La correspondance doit se baser sur les caractéristiques principales : NameFR, Favour, Consignment, Membership, AllowedPOS, etc.
- Si tu trouves une correspondance valide (groupe similaire avec des caractéristiques comparables), inclus la LIGNE COMPLÈTE du groupe similaire dans le résultat.
- Si tu ne trouves PAS de correspondance pertinente pour un groupe CIBLE, tu ne dois PAS inclure ce groupe manquant dans ta réponse (c'est acceptable).

IMPORTANT - Points clés :
- Le nombre de groupes retournés dépend du nombre de VRAIES correspondances trouvées (0 à N groupes).
- Le lot CIBLE peut contenir moins de 5 groupes, ou un nombre variable (pas nécessairement 5).
- Tu dois essayer de matcher chaque groupe CIBLE si une correspondance existe, mais sans forcer de correspondances artificielles.
- Si aucun groupe du lot CIBLE ne trouve de correspondance dans l'événement similaire, tu peux retourner une liste vide (c'est acceptable).

IMPORTANT - Comment utiliser `format_groups` :
- Tu DOIS appeler la fonction `format_groups` pour renvoyer le résultat final.
- Fournis une LISTE DES LIGNES COMPLÈTES (uniquement les groupes similaires qui matchent réellement un groupe CIBLE).
- Exemples de réponses valides :
  * Correspondances trouvées : {{"groups": ["[PriceGroupModel ID=45131] NameFR='Régulier', ...", "[PriceGroupModel ID=45132] NameFR='VIP', ..."]}}
  * Correspondances partielles (3 sur 5) : {{"groups": ["[PriceGroupModel ID=45130] NameFR='Standard', ...", "[PriceGroupModel ID=45131] NameFR='Régulier', ...", "[PriceGroupModel ID=45134] NameFR='Premium', ..."]}}
  * Aucune correspondance : {{"groups": []}}
- Ne renvoie pas de texte libre, n'explique pas ton raisonnement : utilise seulement `format_groups`.
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
                                "enum": ["error", "warning"],
                                "description": "Utiliser 'error' pour une faute bloquante/évidente, 'warning' pour une incohérence suspecte."
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


tool_format_groups = {
    "type": "function",
    "function": {
        "name": "format_groups",
        "description": (
            "Sélectionne et renvoie jusqu'à 5 groupes pertinents pour l'événement similaire donné, "
            "en fonction des groupes de l'événement cible. Retourne une liste des groupes sélectionnés."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "groups": {
                    "type": "array",
                    "description": (
                        "Liste de groupes (chaînes de caractères complètes) sélectionnés pour cet événement similaire. "
                        "Chaque élément est une ligne complète au format: [Model ID=XXXXX] NameFR='...', ..."
                    ),
                    "items": {
                        "type": "string",
                        "description": "Ligne complète du groupe au format: [Model ID=XXXXX] NameFR='...', ..."
                    }
                }
            },
            "required": ["groups"],
        },
    },
}


TOOLS_VALIDATOR: list = [
    tool_report_step_issues
]

TOOLS_PROVIDER: list = [
    tool_format_paths,
    tool_format_groups
]