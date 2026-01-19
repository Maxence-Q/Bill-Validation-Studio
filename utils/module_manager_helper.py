
from typing import Dict, Any, List

def build_full_contribution(data: Dict[str, Any]) -> str:
    """
    Flatten récursivement la section en lignes 'full.path[]: value'.
    Utilisé pour tous les modules.
    """
    if not isinstance(data, dict):
        return ""

    lines: List[str] = []

    def _walk(node: Any, path: str) -> None:
        # Dict → descendre dans les clés
        if isinstance(node, dict):
            for k, v in node.items():
                new_path = f"{path}.{k}" if path else k
                _walk(v, new_path)

        # List → on utilise la notation '[]' dans le path
        elif isinstance(node, list):
            if not node:
                return
            for elem in node:
                # ex: EventDateModelList → EventDateModelList[]
                new_path = path + "[]" if path else "[]"
                _walk(elem, new_path)

        # Scalaire
        else:
            # on skippe les valeurs vides pour alléger un peu
            if node is None or node == "":
                return
            lines.append(f"{path}: {node}")

    _walk(data, "")
    return "\n".join(lines)



def build_list_contribution(data: Dict[str, Any]) -> List[str]:
    """
    Résumé pour les grosses sections Prices / PriceGroups.
    - Si 'PriceGroupModelList' est présent → section PriceGroups.
    - Si 'PriceGroups' est présent → section Prices.
    Sinon, fallback sur un flatten complet.
    """
    if not isinstance(data, dict):
        return ""
    
    unflattened_list = []
    flatten_list = []

    if "PriceGroupModelList" in data:
        # module_id == "PriceGroups" en pratique
        unflattened_list = data.get("PriceGroupModelList") or []

    if "PriceGroups" in data:
        # module_id == "Prices" en pratique
        unflattened_list = data.get("PriceGroups") or []

    if "RightToSellAndFeesModelList" in data:
        # module_id == "RightToSellAndFees" en pratique
        unflattened_list = data.get("RightToSellAndFeesModelList") or []
    
    for item in unflattened_list:
        flatten_list.append(build_full_contribution(item))
    
    return flatten_list


def event_contribution_for_module(module_id: str, data: Dict[str, Any]) -> Any:
    """
    Build user prompt contribution for one module of one event.
    """

    section = data.get(module_id, {})

    if module_id == "Prices" or module_id == "PriceGroups" or module_id == "RightToSellAndFees":
        return build_list_contribution(section)
    else:
        return build_full_contribution(section)
