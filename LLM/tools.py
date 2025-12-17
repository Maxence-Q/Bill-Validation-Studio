SYSTEM_MESSAGE = """
Tu es un assistant de validation de configurations d'événements de billetterie.

Règles globales :

- Tu analyses UN seul module à la fois (Event, OwnerPOS, EventDates, Prices, PriceGroups, FeeDefinitions, RightToSellAndFees, etc.).
- L'entrée contient toujours un événement CIBLE et des événements SIMILAIRES servant de références.
- Tu NE DOIS JAMAIS corriger ou modifier les événements similaires : ils servent uniquement de comparaison.
- Tu dois appliquer strictement la policy du module qui t'est fournie dans un message utilisateur séparé.
- Tu dois toujours utiliser l'outil `format_issues` pour retourner le résultat final.
- Le résultat attendu est un diagnostic structuré du module pour l'événement CIBLE : status + liste d'issues (message, path, severity, suggestion).
- Si aucune anomalie digne de mention n'est détectée, tu renvoies status="ok" et issues=[].
- Tu dois être rigoureux, factuel et concis : n'invente pas de champs et ne te base que sur les données fournies et la policy.
""".strip()

FIRST_USER_MESSAGE = """
Tu dois vérifier les points décrits dans la policy pour le module "{module_id}" sur l'événement CIBLE {target_event_id}.
Tu n'as PAS toutes les données de l'événement directement dans le contexte.
Tu peux appeler en boucle le tool `get_event_field` pour récupérer uniquement les champs nécessaires
de l'événement CIBLE et des 4 événements similaires (sélectionnés par RAG côté système).

Comment utiliser `get_event_field` :
- À chaque fois que tu veux vérifier un point précis de la policy du module, commence par formuler
  une DESCRIPTION claire de ce que tu veux vérifier.
- Appelle ensuite le tool `get_event_field` en lui passant cette description, par exemple :
  - description = "POINT À VÉRIFIER 1"
  - description = "POINT À VÉRIFIER 2"
  - description = "POINT À VÉRIFIER 3"
  - ...
- Le système utilisera cette description pour choisir et te renvoyer un sous-ensemble pertinent
  d'attributs pour l'événement CIBLE et les événements similaires.

Stratégie générale :
- Utilise `get_event_field` autant de fois que nécessaire pour obtenir les informations utiles à ta vérification.
- Pour chaque point de la policy :
  1) identifie ce que tu dois vérifier ;
  2) formule une description explicite ;
  3) appelle `get_event_field` avec cette description ;
  4) analyse les champs retournés et mets à jour ton raisonnement global.

Quand tu formules la description pour `get_event_field` :
- parle en termes de concepts métier.
- tu n’es pas obligé de citer les chemins techniques exacts.
- Un autre système se chargera de mapper ta description vers les chemins techniques pertinents.


Quand tu as terminé l'analyse du module et identifié toutes les anomalies pertinentes pour l'événement CIBLE,
tu DOIS appeler la fonction `format_issues` avec la liste complète d'issues (status et issues[]) au format précédemment indiqué.
""".strip()


FIRST_USER_MESSAGE_SPEC = """
Tu dois vérifier les points décrits dans la policy pour le module "{module_id}" sur l'événement CIBLE {target_event_id}.

IMPORTANT : Ce module gère de grandes quantités de données (Prices, PriceGroups, RightToSellAndFees).
Les données seront livrées par LOTS DE 5 GROUPES à la fois :

Structure des données reçues :
- Chaque appel à `get_event_field` te retournera :
  * UN LOT DE 5 GROUPES (ou moins) de l'événement CIBLE
  * JUSQU'À 5 GROUPES PERTINENTS pour chaque événement similaire (pour comparaison)
- Les lots seront envoyés progressivement à chaque appel de `get_event_field`
- Tu verras la progression : "Batch X/Total | Remaining: Y"

Comment utiliser `get_event_field` :
- Appelle le tool `get_event_field` pour récupérer le lot suivant de groupes
- NOTE : Tu n'as pas besoin de fournir une description détaillée (contrairement au mode standard)
  Tu peux simplement envoyer une brève note (1-2 phrases) pour résumer :
  * Ton analyse du lot précédent
  * Les observations ou anomalies détectées
  * Que tu es prêt pour le lot suivant
- À chaque lot reçu :
  1) analyse les groupes du lot CIBLE
  2) compare-les avec les groupes similaires fournis
  3) identifie les anomalies ou incohérences
  4) note tes observations

Stratégie générale :
- TANT QU'IL Y A DES GROUPES RESTANTS (Remaining > 0), tu DOIS continuer à appeler `get_event_field`
- Pour chaque appel, fournis une brève note de progression ou tes observations
- Accumule ton analyse à travers tous les lots
- Quand la progression indique "Remaining: 0", tous les lots ont été traités

Quand tu as terminé l'analyse de TOUS LES LOTS et identifié toutes les anomalies pertinentes,
tu DOIS appeler la fonction `format_issues` avec la liste complète d'issues (status et issues[]) au format précédemment indiqué.
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



tool_format_issues = {
    "type": "function",
    "function": {
        "name": "format_issues",
        "description": "Uniformise la sortie de validation pour un module donné.",
        "parameters": {
            "type": "object",
            "properties": {
                "module_id": {
                    "type": "string",
                    "description": "Identifiant du module validé (Event, OwnerPOS, Prices, etc.)."
                },
                "status": {
                    "type": "string",
                    "description": "Statut global de la validation pour ce module.",
                    "enum": ["ok", "warning", "error"]
                },
                "issues": {
                    "type": "array",
                    "description": "Liste des anomalies détectées pour ce module.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Chemin ou identifiant du champ problématique."
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["error", "warning", "info"],
                                "description": "Gravité de cette issue."
                            },
                            "message": {
                                "type": "string",
                                "description": "Description courte et claire de l'anomalie."
                            },
                            "suggestion": {
                                "type": "string",
                                "description": "Proposition de correction ou d'action, si applicable."
                            },
                        },
                        "required": ["path", "severity", "message"],
                    },
                },
            },
            "required": ["module_id", "status", "issues"],
        },
    },
}


tool_get_event_field = {
    "type": "function",
    "function": {
        "name": "get_event_field",
        "description": (
            "Récupère un ensemble de champs pertinents pour un point de vérification donné, "
            "sur l'événement CIBLE et les événements similaires."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": (
                        "Description en français du point de la policy que tu veux vérifier. "
                        "Exemples : "
                        "\"Vérifier la cohérence des dates de vente Internet par rapport à la date de représentation\", "
                        "\"Contrôler si les groupes de faveur ont des prix à 0 avec un fake price cohérent\"."
                    ),
                }
            },
            "required": ["description"],
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
    tool_format_issues,
    tool_get_event_field,
]

TOOLS_PROVIDER: list = [
    tool_format_paths,
    tool_format_groups
]