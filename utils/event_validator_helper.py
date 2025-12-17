from typing import Dict, Any, List

def extract_path_from_contribution(contribution: str) -> List[str]:
    """
    Extrait les chemins (paths) uniques de la contribution textuelle.
    """
    paths: List[str] = []
    for line in contribution.splitlines():
        line = line.strip()
        if not line or ": " not in line:
            continue
        path, _ = line.split(": ", 1)
        paths.append(path)
    return list(set(paths))  # Uniques


def build_path_value_from_paths(contribution: str, paths: List[str]) -> str:
    """
    Pour une liste de chemins (paths), extrait les valeurs correspondantes
    de la contribution textuelle.
    Retourne un dictionnaire {path: value}.
    """
    path_value_str: str = ""
    contribution_lines = contribution.splitlines()
    for path in paths:
        for line in contribution_lines:
            line = line.strip()
            if line.startswith(f"{path}: "):
                _, value = line.split(": ", 1)
                path_value_str += f"{path}: {value}\n"
                break
    return path_value_str.strip()
