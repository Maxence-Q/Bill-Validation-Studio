self.current_ctx = {
    "module_id": "temporalite",
    "rules": ["RULE01","RULE02","RULE03","RULE04"],

    # valeurs *résolues* à partir de la FULL config
    "fields": {
        "Event.Event.IsInSale": True,
        "Event.Event.HasNoSpecificDate": False,
        "Event.Event.EventDates[0].Date": "2025-11-03",
        "Event.Event.SalesWindows[0].OpenDate": "2025-10-01T10:00:00-04:00",
        "Event.Event.SalesWindows[0].CloseDate": "2025-11-03T19:00:00-04:00",
        # ...
    },

    # optionnel, pour attacher des informations supplémentaires
    "summary": {
        # par ex. un résumé structuré par "group id" avec quelques clés résumées
        # utile pour bâtir un prompt compact et guidé
        "by_group": {
            "temporalite": {
                "title": "Règles Temporalité (01-04)",
                "highlights": [
                    "IsInSale=True, fenêtre active",
                    "HasNoSpecificDate=False, dates présentes",
                ],
            },
            # ...
        }
    },

    "meta": {
        "event_id": 1234,
        "source": "get_full_config",
        # tu peux ajouter timestamp, operator, etc.
    },
}
