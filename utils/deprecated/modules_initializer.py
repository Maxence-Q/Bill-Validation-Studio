import os
from typing import Any, Dict, List, Tuple
import yaml

# ---------- initialisation des modules LLM ----------
def initialize_modules(
    self,
    yaml_path: str = "artefacts/llm_modules.yaml",
    *,
    default_model: str = "llama-3.1-8b-instant",
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Charge la config YAML et instancie les modules LLM.
    - modules[name] = FinalLLMValidator(model=default_model)
    - modules_meta[name] = dict(title, rules, stage_hint, depends_on, description,...)
    - execution_order depuis orchestration.execution_order
    """
    if not os.path.isfile(yaml_path):
        raise FileNotFoundError(f"Fichier YAML introuvable: {yaml_path}")
    if yaml is None:
        raise RuntimeError(
            "PyYAML n'est pas installé. Fais `pip install pyyaml` pour charger llm_modules.yaml."
        )

    with open(yaml_path, "r", encoding="utf-8") as f:
        doc = yaml.safe_load(f)

    if not isinstance(doc, dict):
        raise ValueError("Le YAML doit contenir un mapping racine.")

    # Orchestration
    orch = doc.get("orchestration", {}) or {}
    order = orch.get("execution_order", []) or []
    if not isinstance(order, list):
        raise ValueError("orchestration.execution_order doit être une liste.")

    # Modules
    modules = doc.get("modules", {}) or {}
    if not isinstance(modules, dict):
        raise ValueError("modules doit être un mapping.")

    return modules, order
