import os
import random
from typing import List, Dict, Tuple, Mapping, Optional


GROQ_API_KEY = os.environ.get("GROQ_API_KEY") or ""
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY") or ""

LLM_NAME_KEY: Dict[str,str] = {
    #"openai/gpt-oss-20b:free": OPENROUTER_API_KEY,
    #"arcee-ai/trinity-mini:free": OPENROUTER_API_KEY,
    #"qwen/qwen3-coder:free": OPENROUTER_API_KEY,
    #"openai/gpt-oss-20b": GROQ_API_KEY,
    "openai/gpt-oss-120b": GROQ_API_KEY,
    "meta-llama/llama-4-maverick-17b-128e-instruct": GROQ_API_KEY,
    "qwen/qwen3-32b": GROQ_API_KEY,
    #"llama-3.3-70b-versatile": GROQ_API_KEY,
    #"meta-llama/llama-4-scout-17b-16e-instruct": GROQ_API_KEY,
    "openai/gpt-oss-safeguard-20b": GROQ_API_KEY,
}

SECTIONS = [
    "Event",
    "OwnerPOS",
    "EventDates",
    #"PriceGroups",
    #"Prices",
    "FeeDefinitions",
    #"RightToSellAndFees"
]


def create_sections_models_mapping(sections: List[str], llm_name_key: Mapping[str, str]) -> Dict[str, Tuple[str, str]]:
    """
    Create a mapping of sections to (model, key) pairs.
    Each section gets a randomly assigned (model, key) pair.
    Both sections and model-key pairs are shuffled.
    
    Args:
        sections: List of section names
        llm_name_key: Dict mapping model names to API keys
        
    Returns:
        Dict mapping section to (model, key) tuple
    """
    # Get all (model, key) pairs
    model_key_pairs = list(llm_name_key.items())
    
    # Shuffle the model-key pairs
    random.shuffle(model_key_pairs)
    
    # Shuffle the sections
    shuffled_sections = sections.copy()
    random.shuffle(shuffled_sections)
    
    # Create mapping by cycling through model-key pairs if there are more sections than models
    sections_models = {}
    for idx, section in enumerate(shuffled_sections):
        model, key = model_key_pairs[idx % len(model_key_pairs)]
        sections_models[section] = (model, key)
    
    return sections_models



"""import requests
import json
response = requests.get(
  url="https://openrouter.ai/api/v1/key",
  headers={
    "Authorization": f"Bearer <OPENROUTER_API_KEY>"
  }
)
print(json.dumps(response.json(), indent=2))"""