export function buildFullContribution(data: any): string {
    if (typeof data !== 'object' || data === null) {
        return "";
    }

    const lines: string[] = [];

    function walk(node: any, path: string) {
        if (Array.isArray(node)) {
            if (node.length === 0) return;
            node.forEach((elem) => {
                // e.g. EventDateModelList -> EventDateModelList[]
                const newPath = path ? path + "[]" : "[]";
                walk(elem, newPath);
            });
        } else if (typeof node === 'object' && node !== null) {
            Object.entries(node).forEach(([k, v]) => {
                const newPath = path ? `${path}.${k}` : k;
                walk(v, newPath);
            });
        } else {
            // Scalar
            if (node === null || node === "") return;
            lines.push(`${path}: ${node}`);
        }
    }

    walk(data, "");
    return lines.join("\n");
}

export function buildListContribution(data: any): string[] {
    if (typeof data !== 'object' || data === null) {
        return [];
    }

    let unflattenedList: any[] = [];

    if (Array.isArray(data)) {
        unflattenedList = data;
    } else {
        // Logic based on Python implementation
        if ("PriceGroupModelList" in data) {
            unflattenedList = data["PriceGroupModelList"] || [];
        } else if ("PriceGroups" in data) {
            unflattenedList = data["PriceGroups"] || [];
        } else if ("RightToSellAndFeesModelList" in data) {
            unflattenedList = data["RightToSellAndFeesModelList"] || [];
        } else if ("EventPriceModelList" in data) {
            unflattenedList = data["EventPriceModelList"] || [];
        } else if ("Prices" in data) {
            unflattenedList = data["Prices"] || [];
        }
    }

    return unflattenedList.map(item => buildFullContribution(item));
}

export function getEventContributionForModule(moduleId: string, data: any): string | string[] {
    const section = data[moduleId] || {};

    if (moduleId === "Prices" || moduleId === "PriceGroups" || moduleId === "RightToSellAndFees") {
        return buildListContribution(section);
    } else {
        return buildFullContribution(section);
    }
}
