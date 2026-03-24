export function resolveIds(data: any): any {
    if (!data) return data;

    // 1. Build Lookups from the event data
    const posLookup: Record<number, string> = {};
    const rts = data?.RightToSellAndFees?.RightToSellAndFeesModelList || [];
    for (const entry of rts) {
        const id = entry?.PointOfSaleID;
        const name = entry?.RO_PointOfSaleName;
        if (id && name) posLookup[id] = name;
    }

    const pgLookup: Record<number, string> = {};
    const pgs = data?.PriceGroups?.PriceGroupModelList || [];
    for (const pg of pgs) {
        const id = pg?.ID;
        const name = pg?.Name || pg?.NameFR || pg?.PriceGroupNameFr;
        if (id && name) pgLookup[id] = name;
    }

    const venueLookup: Record<number, string> = {};
    const eventDates = data?.EventDates?.EventDateModelList || [];
    for (const entry of eventDates) {
        const venue = entry?.Venue;
        if (venue && venue.ID && (venue.Name || venue.DisplayName)) {
            venueLookup[venue.ID] = venue.DisplayName || venue.Name;
        }
    }

    // 2. Recursive Traversal and Replacement
    // We create a deep clone to avoid mutating the original object
    const resolved = JSON.parse(JSON.stringify(data));

    function walk(node: any) {
        if (!node || typeof node !== 'object') return;

        if (Array.isArray(node)) {
            node.forEach(walk);
        } else {
            for (const key of Object.keys(node)) {
                const val = node[key];

                if (typeof val === 'number') {
                    // Resolve POS IDs
                    if ((key === 'PointOfSaleID' || key === 'OwnerPOSID' || key === 'EventPointOfSaleID') && posLookup[val]) {
                        node[key] = `${val} (${posLookup[val]})`;
                    }
                    // Resolve PriceGroup IDs
                    else if ((key === 'PriceGroupID' || key === 'EventPriceGroupID') && pgLookup[val]) {
                        node[key] = `${val} (${pgLookup[val]})`;
                    }
                    // Resolve Venue IDs
                    else if (key === 'VenueID' && venueLookup[val]) {
                        node[key] = `${val} (${venueLookup[val]})`;
                    }
                    // Special case for Price Group ID in list entries
                    else if (key === 'ID' && (node.PriceGroupNameFr || node.PriceGroupNameEn || node.PriceGroupName) && pgLookup[val]) {
                        node[key] = `${val} (${pgLookup[val]})`;
                    }
                }

                walk(val);
            }
        }
    }

    walk(resolved);
    return resolved;
}
