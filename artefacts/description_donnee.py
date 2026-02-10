
# Dictionnaire de règles pour injection dans le tableau CSV
RIGHT_TO_SELL_AND_FEES_RULES= {
    # --- Identifiants (Général) ---
    "ID": "Unique identifier; differences are expected and should not be flagged as anomalies.",
    "EventID": "Specific to each event; differences between target and reference are normal.",
    "PointOfSaleID": "Must match the Reference value to ensure the sales channel is correctly mapped.",
    "UserID": "System internal value; differences are expected and not critical for validation.",
    "AutorisationDate": "Timestamp of record; differences are normal unless a specific business delay is suspected.",

    # --- Montants et Taxes (EventPointOfSale / RightToSellFees) ---
    "Fee1Amount": "Primary fee amount; must strictly match Reference if using exact_match strategy.",
    "Fee2Amount": "Secondary fee amount; must strictly match Reference if using exact_match strategy.",
    "Fee1Tax1Rate": "Tax rate (percentage); must be identical to Reference to ensure fiscal compliance.",
    "Fee1Tax1Amount": "Calculated tax amount; must be consistent with the rate and FeeAmount.",
    "Tax1Rate": "Specific tax percentage; must align with the reference configuration.",
    "Tax2Rate": "Specific tax percentage; must align with the reference configuration.",
    "ChargeTax1": "Boolean flag; must match Reference to ensure taxes are correctly applied or exempted.",
    "ChargeTax2": "Boolean flag; must match Reference to ensure taxes are correctly applied or exempted.",

    # --- Revenus (Income) ---
    "Fee1IncomeInternal": "Internal revenue share; any deviation from Reference impacts financial reporting.",
    "Fee1IncomeForPOS": "Point of Sale revenue share; must align with the contractual reference value.",
    "IncomeInternal": "Specific internal margin; strictly compare against reference for alignment.",
    "IncomeForPOS": "Specific POS margin; strictly compare against reference for alignment.",
    "IncomeForPOSTax1": "Tax on POS income; treat null and 0.0 as equivalent unless logic dictates otherwise.",

    # --- Configuration et Flags ---
    "IsSaleAutorized": "Critical status; must match Reference to ensure the sales channel availability is correct.",
    "Name": "Display name of the fee; should be consistent with the reference for clarity.",
    "FeeType": "Technical category; must match Reference to ensure the correct logic is applied.",
    "ReadOnlyItem": "System flag; differences are usually non-critical unless they prevent required edits.",
    "RO_PointOfSaleName": "Descriptive name of the POS; check for consistency between target and reference.",
    
    # --- Module Prices ---
    "PriceGroupNameFr": "Name of the price group; must match Reference to ensure consistency.",
    "Price": "Selling price; critical financial data that must strictly match the Reference.",
    "VatRate": "Value Added Tax rate; must be identical to Reference for legal compliance.",
    "IsActive": "Operational status; target should match reference to ensure price availability."
}


MODULES_RULES = {
    "RightToSellAndFees": RIGHT_TO_SELL_AND_FEES_RULES,
}