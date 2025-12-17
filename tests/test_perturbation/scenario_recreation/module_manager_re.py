from typing import Dict, Any, Tuple, List, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
import json
import yaml
import os
import shutil
import re
import sys

# Ensure project root is in path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if project_root not in sys.path:
    sys.path.append(project_root)

from tests.test_perturbation.perturbation_engine import PerturbationEngine
# Import the RECREATION validator
from tests.test_perturbation.scenario_recreation.llm_event_validator_re import LlmEventValidator 
from LLM.llm_conf import *
from utils.utils import load_all_ids
from RAG.rag import similar_by_id
from utils.utils import get_ts_api
from utils.module_manager_helper import event_contribution_for_module

class ModuleManager:
    
    def __init__(self) -> None:

        self.perturbation_engine = PerturbationEngine()
        
        self.modules: Dict[str, LlmEventValidator] = {}

        self.eid: int = 0
        self.sim_ids: List[int] = []
        self.events_cache: Dict[int, Dict[str, dict]] = {}

        self.log_path: str = ""

        self.policies: Dict[str, str] = {}
        self.contribution_details: Dict[str, Dict[int, str]] = {} 
        self.llm_responses: Dict[str, str] = {}
        self.llm_performance: Dict[str, Tuple[int, int]] = {} 

    # ---------- get similar events for an id ----------
    def get_similar_events_for_id(self, eid: int, top_k: int = 4, return_full_cache: bool = False, predefined_sim_ids: List[int] = []) -> Tuple[List[int],Dict[int, dict]]:
        
        self.eid = eid
        
        # If predefined sim_ids are provided (from original config), use them
        if predefined_sim_ids:
            # We assume the user wants to fetch data for these IDs
            # We won't re-run RAG to find them, just load them
            similar_ids = predefined_sim_ids
        else:
            _, similar_ids = similar_by_id(eid, top_k=top_k, display=False)

        self.sim_ids = similar_ids

        self.events_cache[eid] = get_ts_api(eid)
        for sid in similar_ids:
            self.events_cache[sid] = get_ts_api(sid)

        if return_full_cache:
            return similar_ids,self.events_cache
        else:
            return similar_ids,{}
    
    # ---------- set log path ----------
    def set_log_path(self, path: str) -> None:
        self.log_path = path

    # ---------- initialize modules ----------
    # ADDED: perturbations_map to pass paths to perturbations.txt files
    def initialize_module(self, sections_models: Dict[str, Tuple[str, str]],modules_list_to_init: List[str] = [], perturbations_map: Dict[str, str] = {}) -> None:

        for module_id, (model, key) in sections_models.items():

            if module_id not in modules_list_to_init:
                continue

            contributions: Dict[int, str] = {}
            for eid, data in self.events_cache.items():
                contributions[eid] = event_contribution_for_module(module_id, data)
            self.contribution_details[module_id] = contributions

            log_path = self.log_path + f"/{module_id}"
            
            # Get perturbation path for this module if exists
            p_path = perturbations_map.get(module_id, "")
            
            module = LlmEventValidator(model=model,
                                       api_key=key, 
                                       module_id=module_id, 
                                       cible_id=self.eid, 
                                       sim_ids=self.sim_ids, 
                                       contributions=contributions,
                                       log_path=log_path,
                                       perturbation_path=p_path) # Pass the path

            self.modules[module_id] = module

    # ---------- attach policy to modules ----------
    def attach_policy_to_module(self, match_policy: Dict[str,str],modules_list_to_attach: List[str] = []) -> Dict[str,str]:
        for module_id, policy in match_policy.items():
            
            if module_id not in modules_list_to_attach:
                continue

            if module_id in self.modules:
                self.modules[module_id].set_policy(policy=policy)
                self.policies[module_id] = policy
        return self.policies


    # ---------- run single module (Threading) ----------
    def _run_single_module_validation(self, module_id: str, module) -> Tuple[str, Any, int, int]:
        try:
            print(f"[THREAD] Starting validation for module: {module_id}")
            response, total_tokens, iter = module.validate_section()
            print(f"[THREAD] Completed validation for module: {module_id} (tokens: {total_tokens}, iterations: {iter})")
        except Exception as e:
            response = f"Error during LLM validation for module {module_id}: {str(e)}"
            total_tokens = 0
            iter = 0
            print(f"[THREAD] Exception in module {module_id}: {str(e)}")
            try:
                error_str = str(e)
                if "'failed_generation'" in error_str:
                    match = re.search(r"'failed_generation':\s*'([^']*(?:\\'[^']*)*)'", error_str)
                    if match:
                        failed_gen = match.group(1).replace('\\n', '\n')
                        response_log_path = os.path.join(self.log_path, f"{module_id}/responses.txt")
                        os.makedirs(os.path.dirname(response_log_path), exist_ok=True)
                        with open(response_log_path, "w", encoding="utf-8") as f:
                            f.write(f"Failed Generation (Tool Validation Error):\n{failed_gen}\nError Details:\n{error_str}\n")
            except Exception:
                pass
        
        return module_id, response, total_tokens, iter

    # ---------- send to llm and get responses ----------
    def start_iterative_validation(self, modules_list_to_send: List[str] = []) -> Dict[str, Any]:
        modules_to_run: Dict[str, Any] = {
            module_id: module
            for module_id, module in self.modules.items()
            if not modules_list_to_send or module_id in modules_list_to_send
        }

        if not modules_to_run:
            return self.llm_responses

        print(f"Starting validation for {len(modules_to_run)} modules: {list(modules_to_run.keys())}")
        max_workers = min(len(modules_to_run), 4)
        executor = ThreadPoolExecutor(max_workers=max_workers)
        
        try:
            future_to_module_id = {
                executor.submit(self._run_single_module_validation, module_id, module): module_id
                for module_id, module in modules_to_run.items()
            }
            completed_count = 0
            for future in as_completed(future_to_module_id, timeout=None):
                module_id = future_to_module_id[future]
                try:
                    mid, result, total_tokens, iter = future.result()
                    self.llm_responses[mid] = result
                    self.llm_performance[mid] = (total_tokens, iter)
                    completed_count += 1
                    print(f"✓ Module {mid} completed successfully ({completed_count}/{len(modules_to_run)})")
                except Exception as e:
                    error_msg = f"Error during LLM validation for module {module_id}: {str(e)}"
                    self.llm_responses[module_id] = error_msg
                    completed_count += 1
                    print(f"✗ Module {module_id} failed: {str(e)} ({completed_count}/{len(modules_to_run)})")
        finally:
            executor.shutdown(wait=True)

        return self.llm_responses

# ==================================================================================
# LOGIC FOR SCENARIO RECREATION
# ==================================================================================
def get_completed_scenarios(logs_root: str) -> List[str]:
    """Finds event folders that have performance.txt in all 4 module subfolders."""
    completed = []
    modules = ["Event", "OwnerPOS", "EventDates", "FeeDefinitions"]
    
    if not os.path.exists(logs_root):
        return []

    for entry in os.listdir(logs_root):
        full_path = os.path.join(logs_root, entry)
        if os.path.isdir(full_path) and re.match(r'event\d+_\d{8}_\d{6}', entry):
            # Check if all modules exist and have performance.txt
            is_complete = True
            for mod in modules:
                perf_file = os.path.join(full_path, mod, "performance.txt")
                if not os.path.exists(perf_file):
                    is_complete = False
                    break
            if is_complete:
                completed.append(entry)
    return completed

def parse_original_config(config_path: str) -> Tuple[int, List[int], Dict[str, Tuple[str, str]]]:
    """Parses config.txt to get ID, Similar IDs and Model Mapping."""
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract ID
    id_match = re.search(r'Random Event ID:\s*(\d+)', content)
    random_eid = int(id_match.group(1)) if id_match else 0
    
    # Extract Similar IDs
    sim_match = re.search(r'Similar Event IDs:\s*\[([\d,\s]+)\]', content)
    sim_ids = []
    if sim_match:
        sim_ids = [int(x.strip()) for x in sim_match.group(1).split(',')]
        
    # Extract Mapping
    map_match = re.search(r'Sections_Models mapping:\s*(\{.*\})', content, re.DOTALL)
    mapping = {}
    if map_match:
        try:
            mapping_raw = json.loads(map_match.group(1))
            # Convert list back to tuple for consistency
            for k, v in mapping_raw.items():
                mapping[k] = tuple(v)
        except json.JSONDecodeError:
            print("Error parsing JSON map in config")
            
    return random_eid, sim_ids, mapping

def rotate_models(mapping: Dict[str, Tuple[str, str]]) -> Dict[str, Tuple[str, str]]:
    """Rotates the models assigned to each module."""
    # Mapping is Module -> (ModelName, Key)
    modules = list(mapping.keys())
    models = list(mapping.values())
    
    # Shift models by 1
    rotated_models = models[1:] + models[:1]
    
    new_mapping = {}
    for i, mod in enumerate(modules):
        new_mapping[mod] = rotated_models[i]
        
    return new_mapping

if __name__ == "__main__":
    print("=== SCENARIO RECREATION START ===")
    
    original_logs_root = os.path.join(project_root, "logs", "module_manager_test")
    completed_scenarios = get_completed_scenarios(original_logs_root)
    
    if not completed_scenarios:
        print("No completed scenarios found to recreate.")
        exit(1)
        
    # Pick random scenario
    selected_scenario_folder = random.choice(completed_scenarios)
    print(f"Selected Scenario: {selected_scenario_folder}")
    
    # Paths
    source_path = os.path.join(original_logs_root, selected_scenario_folder)
    recreation_root = os.path.join(project_root, "logs", "scenario_recreation")
    new_scenario_folder = os.path.join(recreation_root, selected_scenario_folder) # keep same name? Or add prefix? 
    # User said: "create a folder event{Digits}_{YYMMDD}_{HHMMSS) that all his modules subfolder have a performance .txt. We copy and paste this whole event{Digits}_{YYMMDD}_{HHMMSS) folder and put it in logs/scenario_recreation."
    # So we keep the name.
    
    # Clean up destination if exists
    if os.path.exists(new_scenario_folder):
        shutil.rmtree(new_scenario_folder)
    
    # Copy generic
    # shutil.copytree(source_path, new_scenario_folder) 
    # Wait, instructions: "The config.txt and the 4 modules subfolder are then put in a folder called config1 inside event..."
    
    os.makedirs(new_scenario_folder, exist_ok=True)
    config1_path = os.path.join(new_scenario_folder, "config1")
    shutil.copytree(source_path, config1_path)
    
    print(f"Copied original to {config1_path}")
    
    # Create config2 (this is where we will run the new execution)
    config2_path = os.path.join(new_scenario_folder, "config2")
    os.makedirs(config2_path, exist_ok=True)
    
    # Parse original config
    orig_config_file = os.path.join(config1_path, "config.txt")
    eid, sim_ids, original_mapping = parse_original_config(orig_config_file)
    
    # Create new mapping
    rotated_mapping = rotate_models(original_mapping)
    
    print(f"Rotated models. New mapping keys: {list(rotated_mapping.keys())}")
    
    # Write config2/config.txt
    new_config_file = os.path.join(config2_path, "config.txt")
    with open(new_config_file, "w", encoding="utf-8") as f:
        f.write(f"Random Event ID: {eid}\n")
        f.write(f"Similar Event IDs: {sim_ids}\n")
        f.write(f"Sections_Models mapping:\n{json.dumps(rotated_mapping, ensure_ascii=False, indent=2)}\n")
        
    manager = ModuleManager()
    
    # Configure Manager
    manager.set_log_path(config2_path)
    
    # Load Data (using the same IDs)
    # Note: sim_ids comes from config.txt, so we pass it to skip RAG
    # We pass return_full_cache=False because we don't need the return value, just internal state update
    manager.get_similar_events_for_id(eid, predefined_sim_ids=sim_ids)
    
    # Build Perturbations Map
    # Map: ModuleName -> Path to original perturbations.txt
    perturbations_map = {}
    modules_to_run = ["Event", "OwnerPOS", "EventDates", "FeeDefinitions"]
    
    for mod in modules_to_run:
        p_path = os.path.join(config1_path, mod, "perturbations.txt")
        if os.path.exists(p_path):
            perturbations_map[mod] = p_path
            
    print(f"Perturbations map built: {list(perturbations_map.keys())}")

    # Initialize Modules with Perturbation Paths
    manager.initialize_module(sections_models=rotated_mapping, 
                              modules_list_to_init=modules_to_run,
                              perturbations_map=perturbations_map)
    
    # Attach policies (standard procedure)
    with open(os.path.join(project_root, "artefacts/policies.yaml"), "r", encoding="utf-8") as f:
        policies_data = yaml.safe_load(f)
    match_policy = {}
    for module_id in rotated_mapping.keys():
        match_policy[module_id] = policies_data[module_id]['policy']
    manager.attach_policy_to_module(match_policy=match_policy, modules_list_to_attach=modules_to_run)
    
    print("Starting Validation...")
    # Start Validation
    manager.start_iterative_validation(modules_list_to_send=modules_to_run)
    
    print(f"Recreation Complete. Results in {config2_path}")
