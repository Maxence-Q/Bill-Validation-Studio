from typing import Dict, Any, Tuple, List, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
import json
import yaml
import os

from tests.test_perturbation.perturbation_engine import PerturbationEngine
from LLM.llm_event_validator import LlmEventValidator
from LLM.llm_conf import *
from utils.utils import load_all_ids
from utils.utils import extract_signature
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

        self.policies: Dict[str, Dict[str,Any]] = {}

        self.user_prompts: Dict[str, str] = {}
        self.contribution_details: Dict[str, Dict[int, str]] = {} # Dict[module_id, Dict[event_id, contribution]]

        self.llm_responses: Dict[str, str] = {}

        self.llm_performance: Dict[str, Tuple[int, int]] = {} # Dict[module_id, Tuple[total_tokens, iterations]]

    # ---------- get one random id event ----------
    def pick_one_random_event(self) -> int:
        all_ids = load_all_ids()
        return random.choice(all_ids)
    
    # ---------- get similar events for an id ----------
    def get_similar_events_for_id(self, eid: int, top_k: int = 4, return_full_cache: bool = False) -> Tuple[List[int],Dict[int, dict]]:

        _, similar_ids = similar_by_id(eid, top_k=top_k, display=False)

        self.eid = eid
        self.sim_ids = similar_ids

        self.events_cache[eid] = get_ts_api(eid)
        for sid in similar_ids:
            self.events_cache[sid] = get_ts_api(sid)

        if return_full_cache:
            return similar_ids,self.events_cache
        else: # return empty dict
            return similar_ids,{}
    
    # ---------- set log path ----------
    def set_log_path(self, path: str) -> None:
        self.log_path = path

    # ---------- initialize modules ----------
    def initialize_module(self, sections_models: Dict[str, Tuple[str, str]],modules_list_to_init: List[str] = [], run_config:Dict[str, Any] = {}) -> None:

        for module_id, (model, key) in sections_models.items():

            if module_id not in modules_list_to_init:
                continue

            contributions: Dict[int, str] = {}
            for eid, data in self.events_cache.items():
                contributions[eid] = event_contribution_for_module(module_id, data)
            self.contribution_details[module_id] = contributions

            log_path = self.log_path + f"/{module_id}"
            module = LlmEventValidator(model=model,
                                       api_key=key,
                                       module_id=module_id, 
                                       cible_id=self.eid, 
                                       sim_ids=self.sim_ids, 
                                       contributions=contributions,
                                       log_path=log_path,
                                       run_config=run_config)

            self.modules[module_id] = module

    # ---------- attach policy to modules ----------
    def attach_policy_to_module(self, match_policy: Dict[str,Dict[str,Any]],modules_list_to_attach: List[str] = []) -> Dict[str,Dict[str,Any]]:
        for module_id, policy in match_policy.items():
            
            if module_id not in modules_list_to_attach:
                continue

            if module_id in self.modules:

                self.modules[module_id].set_policy(policy=policy)
                self.policies[module_id] = policy
        return self.policies


    # ---------- run single module (Threading) ----------
    def _run_single_module_validation(self, module_id: str, module) -> Tuple[str, Any, int, int]:
        """
        Exécute validate_section() pour un module avec gestion d'erreur.
        Retourne (module_id, response_or_error_string, total_tokens, iterations).
        En cas d'erreur, extrait failed_generation si disponible et le log.
        """
        try:
            print(f"[THREAD] Starting validation for module: {module_id}")
            if module_id == "Prices" or module_id == "PriceGroups" or module_id == "RightToSellAndFees":
                func = module.validate_section_spec
            else:
                func = module.validate_section
            response, total_tokens, iter = func()
            print(f"[THREAD] Completed validation for module: {module_id} (tokens: {total_tokens}, iterations: {iter})")
        except Exception as e:
            response = f"Error during LLM validation for module {module_id}: {str(e)}"
            total_tokens = 0
            iter = 0
            print(f"[THREAD] Exception in module {module_id}: {str(e)}")
            
            # Try to extract failed_generation from the error message
            try:
                error_str = str(e)
                if "'failed_generation'" in error_str:
                    # Extract the failed_generation JSON
                    import re
                    match = re.search(r"'failed_generation':\s*'([^']*(?:\\'[^']*)*)'", error_str)
                    if match:
                        failed_gen = match.group(1)
                        # Replace escaped newlines with actual newlines for readability
                        failed_gen = failed_gen.replace('\\n', '\n')
                        
                        # Log to responses.txt
                        response_log_path = os.path.join(self.log_path, f"{module_id}/responses.txt")
                        os.makedirs(os.path.dirname(response_log_path), exist_ok=True)
                        
                        with open(response_log_path, "w", encoding="utf-8") as f:
                            f.write(f"Failed Generation (Tool Validation Error):\n")
                            f.write(f"{'='*60}\n")
                            f.write(f"{failed_gen}\n")
                            f.write(f"{'='*60}\n\n")
                            f.write(f"Error Details:\n{error_str}\n")
            except Exception as log_error:
                print(f"[THREAD] Exception in module {module_id}: more than just a calling failure: {log_error}")
                pass
        
        return module_id, response, total_tokens, iter

    # ---------- send to llm and get responses ----------
    def start_iterative_validation(self, modules_list_to_send: List[str] = []) -> Dict[str, Any]:
        """
        Lance la validation LLM de tous les modules sélectionnés, en parallèle (thread pool).
        modules_list_to_send : si non vide, ne traite que ces module_id.
        Remplit self.llm_responses[module_id] pour chaque module.
        """

        # Filtre les modules à valider
        modules_to_run: Dict[str, Any] = {
            module_id: module
            for module_id, module in self.modules.items()
            if not modules_list_to_send or module_id in modules_list_to_send
        }

        if not modules_to_run:
            return self.llm_responses

        print(f"Starting validation for {len(modules_to_run)} modules: {list(modules_to_run.keys())}")

        # Tu peux ajuster max_workers selon ton confort / limites TPM
        max_workers = min(len(modules_to_run), 4)

        executor = ThreadPoolExecutor(max_workers=max_workers)
        
        try:
            future_to_module_id = {
                executor.submit(self._run_single_module_validation, module_id, module): module_id
                for module_id, module in modules_to_run.items()
            }

            print(f"Submitted {len(future_to_module_id)} tasks to executor")

            completed_count = 0
            for future in as_completed(future_to_module_id, timeout=None):
                module_id = future_to_module_id[future]
                try:
                    print(f"Processing result for module: {module_id}")
                    mid, result, total_tokens, iter = future.result()
                    self.llm_responses[mid] = result
                    self.llm_performance[mid] = (total_tokens, iter)
                    completed_count += 1
                    print(f"✓ Module {mid} completed successfully ({completed_count}/{len(modules_to_run)})")
                except Exception as e:
                    # Cas très rare : exception dans le wrapper lui-même
                    error_msg = f"Error during LLM validation for module {module_id}: {str(e)}"
                    self.llm_responses[module_id] = error_msg
                    completed_count += 1
                    print(f"✗ Module {module_id} failed: {str(e)} ({completed_count}/{len(modules_to_run)})")

        finally:
            # Explicitly shutdown and wait for all tasks to complete
            executor.shutdown(wait=True)

        print(f"Validation completed. Processed {len(self.llm_responses)} modules")
        return self.llm_responses

    # ---------- run multiple models on one module ----------
    def run_multiple_model_on_one_module(self, module_id: str, policy: Dict[str,Any], models_keys: Dict[str,str], run_config: Dict[str, Any] = {}) -> Dict[str, Dict[str, Any]]:
        """
        Exécute la validation LLM pour un module donné avec plusieurs (modèle, clé) pairs.
        Retourne un dictionnaire de réponses par modèle.
        """

        contributions: Dict[int, str] = {}
        for eid, data in self.events_cache.items():
            contributions[eid] = event_contribution_for_module(module_id, data)
        self.contribution_details[module_id] = contributions

        first_model, first_key = list(models_keys.items())[0]
        module = LlmEventValidator(model=first_model,
                                    api_key=first_key,
                                    module_id=module_id, 
                                    cible_id=self.eid, 
                                    sim_ids=self.sim_ids, 
                                    contributions=contributions,
                                    log_path=self.log_path,
                                    run_config=run_config)
        
        module.set_policy(policy=policy)

        output = module.validate_section_with_multiple_models(models_keys=models_keys)

        return output


    def run_multiple_config_and_model_on_one_module(self, module_id: str, policies: Dict[str,Dict[str,Any]], models_keys: Dict[str,str], grid_search: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        """
        Exécute la validation LLM pour un module donné avec plusieurs (modèle, clé) pairs.
        Retourne un dictionnaire de réponses par modèle.
        """

        contributions: Dict[int, str] = {}
        for eid, data in self.events_cache.items():
            contributions[eid] = event_contribution_for_module(module_id, data)
        self.contribution_details[module_id] = contributions

        first_model, first_key = list(models_keys.items())[0]
        log_path = os.path.join(os.path.dirname(__file__), "logs", "module_manager_test_v5", module_id)
        module = LlmEventValidator(model=first_model,
                                    api_key=first_key,
                                    module_id=module_id, 
                                    cible_id=self.eid, 
                                    sim_ids=self.sim_ids, 
                                    contributions=contributions,
                                    log_path=log_path,
                                    run_config=grid_search[1])
        
        module.set_policy(policies=policies)

        output = module.validate_section_with_multiple_configs_and_models(models_keys=models_keys, grid_search=grid_search)

        return output

if __name__ == "__main__":


    grid_search = [
        {"temperature": 0.0, "language": "fr", "num_references": 4, "policy": "strict"},
        #{"temperature": 0.1, "language": "fr", "num_references": 4, "policy": "strict"},
        #{"temperature": 0.0, "language": "en", "num_references": 4, "policy": "strict"},
        #{"temperature": 0.1, "language": "en", "num_references": 4, "policy": "strict"},
        #{"temperature": 0.0, "language": "fr", "num_references": 2, "policy": "strict"},
        #{"temperature": 0.1, "language": "fr", "num_references": 2, "policy": "strict"},
        #{"temperature": 0.0, "language": "en", "num_references": 2, "policy": "strict"},
        #{"temperature": 0.1, "language": "en", "num_references": 2, "policy": "strict"},
        #{"temperature": 0.0, "language": "fr", "num_references": 4, "policy": "soft"},
        #{"temperature": 0.1, "language": "fr", "num_references": 4, "policy": "soft"},
        #{"temperature": 0.0, "language": "en", "num_references": 4, "policy": "soft"},
        #{"temperature": 0.1, "language": "en", "num_references": 4, "policy": "soft"},
        #{"temperature": 0.0, "language": "fr", "num_references": 2, "policy": "soft"},
        #{"temperature": 0.1, "language": "fr", "num_references": 2, "policy": "soft"},
        {"temperature": 0.0, "language": "en", "num_references": 2, "policy": "soft"},
        #{"temperature": 0.1, "language": "en", "num_references": 2, "policy": "soft"},
    ]
    module_to_test = "FeeDefinitions"


    print("==============================================================")
    print("==============================================================")
    print("=== Module Manager Test ===")
    print("==============================================================")
    print("==============================================================")
    print("\n\n\n")

    manager = ModuleManager()
    
    random_eid = manager.pick_one_random_event()
    sids, events_cache = manager.get_similar_events_for_id(random_eid, top_k=4, return_full_cache=True)

    print("Picked random event ID:", random_eid)

    with open("artefacts/policies.yaml", "r", encoding="utf-8") as f:
        policies_data = yaml.safe_load(f)
    with open("artefacts/soft_policies.yaml", "r", encoding="utf-8") as f:
        soft_policies_data = yaml.safe_load(f)
    policies = {"soft": soft_policies_data[module_to_test], "strict": policies_data[module_to_test]}
    output = manager.run_multiple_config_and_model_on_one_module(module_to_test, policies, LLM_NAME_KEY, grid_search=grid_search)


    # =================================
    # CI_DESSOUS V3
    # =================================
    '''
    grid_search = [
        {"temperature": 0.0, "language": "fr"},
        {"temperature": 0.25, "language": "fr"},
        {"temperature": 0.0, "language": "en"},
    ]
    run_config = grid_search[2]

    module_to_test = "EventDates"


    print("==============================================================")
    print("==============================================================")
    print("=== Module Manager Test ===")
    print("==============================================================")
    print("==============================================================")
    print("\n\n\n")

    manager = ModuleManager()
    
    random_eid = manager.pick_one_random_event()
    sids, events_cache = manager.get_similar_events_for_id(random_eid, top_k=4, return_full_cache=True)

    # in logs/module_manager_test, create folder event{random_eid}_{datetime} (year,month,date,hour,minute,second)
    log_path = f"/logs/module_manager_test_v3/{module_to_test}/event{random_eid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    try:
        os.makedirs(log_path, exist_ok=True)
    except PermissionError:
        log_path = os.path.join(os.path.dirname(__file__), "logs", "module_manager_test_v3", module_to_test, f"event{random_eid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        os.makedirs(log_path, exist_ok=True)

    manager.set_log_path(log_path)

    # 3. CONSTRUCTION DU DICTIONNAIRE DE SIGNATURES
    signatures_summary = {
        "TARGET_EVENT": {
            f"ID_{random_eid}": extract_signature(events_cache.get(random_eid, {}))
        },
        "SIMILAR_EVENTS": {}
    }
    for sid in sids:
        signatures_summary["SIMILAR_EVENTS"][f"ID_{sid}"] = extract_signature(events_cache.get(sid, {}))

    # 4. ÉCRITURE DANS LE FICHIER DE CONFIG
    overview_log_path = os.path.join(log_path, "overview.txt")
    with open(overview_log_path, "w", encoding="utf-8") as f:
        f.write(f"Random Event ID: {random_eid}\n")
        f.write(f"Similar Event IDs: {sids}\n")
        
        f.write("\n" + "="*50 + "\n")
        f.write("=== RAG PERFORMANCE CHECK (SIGNATURES) ===\n")
        f.write("="*50 + "\n")
        f.write(json.dumps(signatures_summary, ensure_ascii=False, indent=2))
        f.write("\n")

    print("Overview written to:", overview_log_path)

    with open("artefacts/policies.yaml", "r", encoding="utf-8") as f:
        policies_data = yaml.safe_load(f)

    config_log_path = os.path.join(log_path, "run_config.json")
    with open(config_log_path, "w", encoding="utf-8") as f:
        json.dump(run_config, f, ensure_ascii=False, indent=2)
    print("Run config written to:", config_log_path)

    output = manager.run_multiple_model_on_one_module(module_to_test, policies_data[module_to_test], LLM_NAME_KEY, run_config=run_config)

    '''
 

    # =================================
    # CI_DESSOUS V2
    # =================================

    '''
    # Create the mapping with shuffled sections and random (model, key) pairs
    Sections_Models = create_sections_models_mapping(SECTIONS, LLM_NAME_KEY)
    sections_models_safe = {
        module: info[0] 
        for module, info in Sections_Models.items()
    }
    
    random_eid = manager.pick_one_random_event()
    sids, events_cache = manager.get_similar_events_for_id(random_eid, top_k=4, return_full_cache=True)

    # in logs/module_manager_test, create folder event{random_eid}_{datetime} (year,month,date,hour,minute,second)
    log_path = f"/logs/module_manager_test_v2/event{random_eid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    try:
        os.makedirs(log_path, exist_ok=True)
    except PermissionError:
        log_path = os.path.join(os.path.dirname(__file__), "logs", "module_manager_test_v2", f"event{random_eid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        os.makedirs(log_path, exist_ok=True)

    manager.set_log_path(log_path)

    # 3. CONSTRUCTION DU DICTIONNAIRE DE SIGNATURES
    signatures_summary = {
        "TARGET_EVENT": {
            f"ID_{random_eid}": extract_signature(events_cache.get(random_eid, {}))
        },
        "SIMILAR_EVENTS": {}
    }
    for sid in sids:
        signatures_summary["SIMILAR_EVENTS"][f"ID_{sid}"] = extract_signature(events_cache.get(sid, {}))

    # 4. ÉCRITURE DANS LE FICHIER DE CONFIG
    config_log_path = os.path.join(log_path, "config.txt")
    with open(config_log_path, "w", encoding="utf-8") as f:
        f.write(f"Random Event ID: {random_eid}\n")
        f.write(f"Similar Event IDs: {sids}\n")
        f.write(f"Sections_Models mapping:\n{json.dumps(sections_models_safe, ensure_ascii=False, indent=2)}\n")
        
        f.write("\n" + "="*50 + "\n")
        f.write("=== RAG PERFORMANCE CHECK (SIGNATURES) ===\n")
        f.write("="*50 + "\n")
        f.write(json.dumps(signatures_summary, ensure_ascii=False, indent=2))
        f.write("\n")

        
    print("Config written to:", config_log_path)


    modules_to_debug = ["PriceGroups","Prices","RightToSellAndFees"]
    manager.initialize_module(sections_models=Sections_Models, modules_list_to_init=modules_to_debug)
    
    with open("artefacts/policies.yaml", "r", encoding="utf-8") as f:
        policies_data = yaml.safe_load(f)
    match_policy = {}
    for module_id in Sections_Models.keys():
        match_policy[module_id] = policies_data[module_id]
    policies = manager.attach_policy_to_module(match_policy=match_policy,modules_list_to_attach=modules_to_debug)


    print("\n\n\n")
    print("==============================================================")
    print("==============================================================")
    print("Starting iterative LLM validation for all modules...")
    print("==============================================================")
    print("==============================================================")
    print("\n\n\n")

    llm_responses = manager.start_iterative_validation(modules_list_to_send=modules_to_debug)

    print("\n\n\n")
    print("==============================================================")
    print("==============================================================")
    print("Writing logs...")
    print("==============================================================") 
    print("==============================================================")
    print("\n\n\n")

    stats_log_path = os.path.join(log_path, "stats.txt")
    with open(stats_log_path, "w", encoding="utf-8") as f:
        f.write("=== STATS BY MODULE ===\n\n")
        for module_id in Sections_Models.keys():
            if module_id in manager.modules:
                stats = manager.modules[module_id].stats
                f.write(f"--- Module: {module_id} ---\n")
                for stat_name, stat_value in stats.items():
                    f.write(f"{stat_name}: {stat_value}\n")
                f.write("\n")

    '''