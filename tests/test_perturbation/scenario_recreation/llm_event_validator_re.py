
# libs import
from __future__ import annotations
from typing import Any, Dict, Optional, List, Tuple
import os
import re
import json, textwrap
from openai import OpenAI
from langsmith.wrappers import wrap_openai

# files import
from LLM.tools import *
from utils.event_validator_helper import *
from tests.test_perturbation.perturbation_engine import PerturbationEngine


class LlmEventValidator:
    def __init__(self, model: str = "openai/gpt-oss-120b",
                 api_key: str="",
                 module_id: str = "Event", 
                 cible_id: int = 0, 
                 sim_ids: list[int] = [], 
                 contributions: dict[int,str]={},
                 log_path: str = "",
                 perturbation_path: str = "") -> None:


        # Determine which API provider to use based on the model name
        if ":free" in model:
            # OpenRouter models
            base_url = "https://openrouter.ai/api/v1"
        else:
            # Default to Groq (e.g., "openai/gpt-oss-120b")
            base_url = "https://api.groq.com/openai/v1"

        self.client = wrap_openai(OpenAI(
            api_key=api_key,
            base_url=base_url,
        ))
        # Note: If LlmPathProvider logic needs to be exactly duplicated or imported, we rely on the original
        # assuming LLM.llm_event_validator.LlmPathProvider is available via import or copy-paste.
        # Ideally we should import LlmPathProvider from original file to avoid duplication if it's identical.
        # But instructions said "recreate ... but with a big twist", and usually we might want independence.
        # However, to avoid missing dependencies, I'll assume LlmPathProvider is available from LLM.llm_event_validator
        # or I should copy it here. The prompt implies "recreate module_manager.py ... and llm_event_validator.py".
        # I will include LlmPathProvider in this file to be safe and self-contained as per "copy of" instruction.
        self.path_provider = LlmPathProvider(modele=model,api_key=api_key,base_url=base_url)

        self.perturbation_engine = PerturbationEngine()

        self.model = model

        self.module_id: str = module_id
        self.cible_id: int = cible_id
        self.similar_ids: list[int] = sim_ids
        self.contributions: dict[int,str] = contributions

        self.payload: Optional[Dict[str, Dict[int, List[str]]]] = None
        self.payload_iterator: int = 0
        self.payload_keys: List[str] = []
        
        if (module_id == "Prices" or module_id == "PriceGroups" or module_id == "RightToSellAndFees") and contributions:
            self.payload = self.build_payload_for_summarized_modules()
            self.payload_keys = list(self.payload.keys())

        self.batch_iterator: int = 0
        self.batch_length: int = len(contributions.get(cible_id,"").splitlines())

        self.log_path: str = log_path

        self.system_message: str = SYSTEM_MESSAGE

        self.policy: str | None = None
        
        # Perturbed memory: tracks which paths were perturbed in each iteration
        self.perturbed_memory: Dict[int, List[str]] = {}
        
        # Store the final perturbed payload sent to LLM (for detailed analysis)
        self.final_perturbed_payload: Dict[int, str] = {}

        if module_id in ["Prices", "PriceGroups", "RightToSellAndFees"]:
            self.first_user_message: str = FIRST_USER_MESSAGE_SPEC.format(
            module_id=self.module_id,
            target_event_id=self.cible_id,
            )
        else:
            self.first_user_message: str = FIRST_USER_MESSAGE.format(
                module_id=self.module_id,
                target_event_id=self.cible_id,
            )

        # SCENARIO RECREATION SPECIFIC: Load original perturbations
        self.recreation_perturbations: Dict[str, str] = {}
        if perturbation_path and os.path.exists(perturbation_path):
            self._load_original_perturbations(perturbation_path)


    def _load_original_perturbations(self, path: str):
        """
        Parses the perturbations.txt file to extract 'path: perturbed_value' mappings.
        Storage format: self.recreation_perturbations[path] = full_line_string
        """
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find all "Perturbed Block:" sections
            # The format seems to be JSON output.
            # We can use regex to find the JSON blocks following "Perturbed Block:"
            
            # Simple approach: iterate line by line, look for JSON content inside Perturbed Block
            # But regex might be cleaner if blocks are well formed. 
            # Given the file view, it looks like:
            # Perturbed Block:
            # {
            #   "6": "Event.IsHistory: true",
            #   ...
            # }
            
            # Regex to capture content between curly braces after "Perturbed Block:"
            # Note: This simple regex assumes the JSON doesn't have nested curly braces that would break checking.
            # The example shows simple key-value pairs.
            
            blocks = re.findall(r'Perturbed Block:\s*(\{.*?\})', content, re.DOTALL)
            
            for block_str in blocks:
                try:
                    data = json.loads(block_str)
                    for val in data.values():
                        # val is like "Event.IsHistory: true"
                        if ": " in val:
                            path_part = val.split(": ", 1)[0]
                            self.recreation_perturbations[path_part] = val
                except json.JSONDecodeError:
                    pass
                    
            print(f"Loaded {len(self.recreation_perturbations)} original perturbations for module {self.module_id}")
            
        except Exception as e:
            print(f"Error loading perturbations from {path}: {e}")

    def build_payload_for_summarized_modules(self) -> Dict[str, Dict[int, List[str]]]:
        """  
        Pour les modules Prices, PriceGroups, RightToSellAndFees:
        Summary logic mirrored from original file.
        """
        module_id = self.module_id
        cible_id = self.cible_id
        similar_ids = self.similar_ids

        cible_contribution = self.contributions.get(cible_id, "")
        sim_groups: dict[int, str] = {}
        for eid in similar_ids:
            sim_groups[eid] = self.contributions.get(eid, "")

        cible_lines = cible_contribution.splitlines()
        batch_size = 5
        batches = []
        
        for i in range(0, len(cible_lines), batch_size):
            batch = cible_lines[i:i + batch_size]
            batches.append("\n".join(batch))
        
        payload: Dict[str, Dict[int, List[str]]] = {}
        for batch_idx, batch_contribution in enumerate(batches):
            relevant_groups = self.path_provider.provide_groups(t_batch=batch_contribution, t_id=cible_id, groups=sim_groups)  
            payload[batch_contribution] = relevant_groups
        return payload


    def set_policy(self, policy: str) -> None:
        self.policy = (policy or "").strip() or None
    
    
    def _extract_paths_from_perturbed(self, perturbed: Dict[int, str]) -> List[str]:
        paths = []
        for line in perturbed.values():
            if ": " in line:
                path = line.split(": ", 1)[0]
                paths.append(path)
        return paths
    
    
    def _compute_confusion_matrix(self, llm_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Flatten all perturbed paths across all iterations
        all_perturbed_paths = set()
        for paths_list in self.perturbed_memory.values():
            all_perturbed_paths.update(paths_list)
        
        detected_paths = set()
        for issue in llm_issues:
            if isinstance(issue, dict) and "path" in issue:
                detected_paths.add(issue["path"])
        
        true_positives = all_perturbed_paths & detected_paths
        false_positives = detected_paths - all_perturbed_paths
        false_negatives = all_perturbed_paths - detected_paths
        true_negatives = 0
        
        confusion_matrix = {
            "TP": len(true_positives),
            "FP": len(false_positives),
            "FN": len(false_negatives),
            "TN": true_negatives,
        }
        
        total_perturbed = len(all_perturbed_paths)
        detected_count = len(detected_paths)
        
        metrics = {
            "precision": len(true_positives) / detected_count if detected_count > 0 else 0,
            "recall": len(true_positives) / total_perturbed if total_perturbed > 0 else 0,
            "accuracy": len(true_positives) / (len(true_positives) + len(false_positives) + len(false_negatives)) if (len(true_positives) + len(false_positives) + len(false_negatives)) > 0 else 0,
        }
        
        perturbed_analysis = {
            "perturbed_paths_found": list(true_positives),
            "perturbed_paths_missed": list(false_negatives),
            "false_positive_paths": list(false_positives),
        }
        
        return {
            "confusion_matrix": confusion_matrix,
            "metrics": metrics,
            "perturbed_analysis": perturbed_analysis,
            "all_perturbed_paths": list(all_perturbed_paths),
            "all_detected_paths": list(detected_paths),
        }

    
    
    def _handle_get_event_field(self, description: str) -> Dict[int, str]:
        module_id = self.module_id
        cible_id = self.cible_id
        similar_ids = self.similar_ids

        cible_contribution = self.contributions.get(cible_id, "")
        
        all_paths = extract_path_from_contribution(cible_contribution)
        relevant_paths = self.path_provider.provide_path(description=description, paths=all_paths)
        
        payload: Dict[int, str] = {}
        for eid in [cible_id] + similar_ids:
            contribution = self.contributions.get(eid, "")
            path_value_str = build_path_value_from_paths(contribution, relevant_paths)
            payload[eid] = path_value_str
        
        return payload


    def validate_section(self) -> Tuple[str, int, int]:
        module_id = self.module_id

        prompt_log_path = os.path.join(self.log_path, f"prompts.txt")
        os.makedirs(os.path.dirname(prompt_log_path), exist_ok=True)

        response_log_path = os.path.join(self.log_path, f"responses.txt")
        os.makedirs(os.path.dirname(response_log_path), exist_ok=True)

        performance_log_path =  os.path.join(self.log_path, f"performance.txt")
        os.makedirs(os.path.dirname(performance_log_path), exist_ok=True)

        perturbations_log_path =  os.path.join(self.log_path, f"perturbations.txt")
        os.makedirs(os.path.dirname(perturbations_log_path), exist_ok=True)

        messages = [
            {"role": "system", "content": self.system_message},
            {"role": "user", "content": self.policy},
            {"role": "user", "content": self.first_user_message},
        ]

        iter=1

        while True:

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0,
                tools=TOOLS_VALIDATOR,
                tool_choice="auto",
            )

            choice = resp.choices[0]
            msg = choice.message

            tool_calls = getattr(msg, "tool_calls", None)
            if tool_calls:
                messages.append({
                    "role": "assistant",
                    "tool_calls": [tc for tc in tool_calls],
                })

                for tc in tool_calls:
                    name = tc.function.name
                    args = json.loads(tc.function.arguments)

                    if name == "get_event_field":
                        description = args["description"]

                        with open(prompt_log_path, "a", encoding="utf-8") as f:
                            f.write(f"--- Iteration {iter} ---\n")
                            f.write(f"Description:\n{description}\n\n")

                        if module_id in ["Prices", "PriceGroups", "RightToSellAndFees"]:
                            if self.payload is not None and self.payload_iterator < len(self.payload_keys):
                                current_key = self.payload_keys[self.payload_iterator]
                                payload = {current_key: self.payload[current_key]}
                                groups_sent = self.payload_iterator + 1
                                groups_remaining = len(self.payload_keys) - groups_sent
                                total_groups = len(self.payload_keys)
                                progress_info = f"Batch {groups_sent}/{total_groups} | Remaining: {groups_remaining}"
                                self.payload_iterator += 1
                            else:
                                payload = {}
                                progress_info = "All batches processed"
                        else:
                            payload = self._handle_get_event_field(description=description)
                            progress_info = None

                        with open(prompt_log_path, "a", encoding="utf-8") as f:
                            f.write(f"Payload returned:\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n")
                            if progress_info:
                                f.write(f"Progress: {progress_info}\n")
                            f.write("\n")

                        #########################
                        #  RE-INJECT SPECIFIC PERTURBATIONS
                        #########################
                        original_block = payload.get(self.cible_id, "")
                        
                        # Instead of calling perturbation engine, we match against loaded original perturbations
                        original_map = {}
                        perturbed_map = {}
                        
                        block_lines = [line.strip() for line in original_block.splitlines() if line.strip()]
                        
                        final_lines = []
                        
                        # Because the format of 'original' and 'perturbed' in log is a Dict[line_index, content]
                        # we need to maintain that structure for logging consistency.
                        
                        for idx, line in enumerate(block_lines):
                            # line format: "Path: Value"
                            if ": " in line:
                                path_part = line.split(": ", 1)[0]
                                
                                # Store as original
                                original_map[str(idx)] = line
                                
                                if path_part in self.recreation_perturbations:
                                    # Use the perturbed value
                                    perturbed_val = self.recreation_perturbations[path_part]
                                    perturbed_map[str(idx)] = perturbed_val
                                    final_lines.append(perturbed_val)
                                else:
                                    # Keep original
                                    final_lines.append(line)
                            else:
                                final_lines.append(line)

                        block = "\n".join(final_lines)
                        
                        # Store perturbed paths in memory for confusion matrix later
                        perturbed_paths = self._extract_paths_from_perturbed(perturbed_map)
                        self.perturbed_memory[iter] = perturbed_paths
                        
                        # Update the payload with the perturbed block
                        payload[self.cible_id] = block
                        
                        # Store the final perturbed payload for detailed analysis
                        self.final_perturbed_payload[self.cible_id] = block

                        with open(perturbations_log_path, "a", encoding="utf-8") as f:
                            f.write(f"--- Iteration {iter} ---\n\n")
                            f.write(f"Original Block:\n{json.dumps(original_map, ensure_ascii=False, indent=2)}\n")
                            f.write(f"Perturbed Block:\n{json.dumps(perturbed_map, ensure_ascii=False, indent=2)}\n")
                            f.write("\n")

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": "get_event_field",
                            "content": json.dumps(payload, ensure_ascii=False),
                        })

                        iter += 1
                        continue

                    elif name == "format_issues":

                        with open(response_log_path, "a", encoding="utf-8") as f:
                            f.write(f"--- Iteration {iter} ---\n")
                            f.write(f"Format issues called with args:\n{json.dumps(args, ensure_ascii=False, indent=2)}\n\n")
                        result_obj = args

                        llm_issues = args.get("issues", [])
                        confusion_analysis = self._compute_confusion_matrix(llm_issues)
                        
                        with open(performance_log_path, "a", encoding="utf-8") as f:
                            f.write("="*80 + "\n")
                            f.write("CONFUSION MATRIX ANALYSIS\n")
                            f.write("="*80 + "\n\n")
                            
                            cm = confusion_analysis["confusion_matrix"]
                            f.write("Confusion Matrix:\n")
                            f.write(f"  True Positives (TP):  {cm['TP']}  (perturbed paths detected)\n")
                            f.write(f"  False Positives (FP): {cm['FP']}  (non-perturbed paths detected)\n")
                            f.write(f"  False Negatives (FN): {cm['FN']}  (perturbed paths missed)\n")
                            f.write(f"  True Negatives (TN):  {cm['TN']}\n\n")
                            
                            metrics = confusion_analysis["metrics"]
                            f.write("Performance Metrics:\n")
                            f.write(f"  Precision: {metrics['precision']:.4f}  (of detected issues, how many were actually perturbed)\n")
                            f.write(f"  Recall:    {metrics['recall']:.4f}  (of perturbed paths, how many were detected)\n")
                            f.write(f"  Accuracy:  {metrics['accuracy']:.4f}  (overall correctness)\n\n")
                            
                            analysis = confusion_analysis["perturbed_analysis"]
                            f.write("Perturbed Paths Analysis:\n")
                            f.write(f"  Total Perturbed Paths: {len(confusion_analysis['all_perturbed_paths'])}\n")
                            f.write(f"  Detected Perturbed Paths (TP): {len(analysis['perturbed_paths_found'])}\n")
                            if analysis['perturbed_paths_found']:
                                f.write(f"    - {json.dumps(analysis['perturbed_paths_found'], ensure_ascii=False, indent=6)}\n")
                            
                            f.write(f"\n  Missed Perturbed Paths (FN): {len(analysis['perturbed_paths_missed'])}\n")
                            if analysis['perturbed_paths_missed']:
                                f.write(f"    - {json.dumps(analysis['perturbed_paths_missed'], ensure_ascii=False, indent=6)}\n")
                            
                            f.write(f"\n  False Positive Paths (FP): {len(analysis['false_positive_paths'])}\n")
                            if analysis['false_positive_paths']:
                                f.write(f"    - {json.dumps(analysis['false_positive_paths'], ensure_ascii=False, indent=6)}\n")
                            
                            f.write("\n" + "="*80 + "\n")
                            f.write(f"Total tokens used: {resp.usage.total_tokens}\n")  #type: ignore
                            f.write(f"Number of iterations: {iter}\n")
                            f.write("="*80 + "\n\n")
                            
                            f.write("="*80 + "\n")
                            f.write("DETAILED PERTURBED PATHS WITH CONTEXT\n")
                            f.write("="*80 + "\n\n")
                            
                            for perturbed_path in confusion_analysis['all_perturbed_paths']:
                                detected_status = "✓ DETECTED" if perturbed_path in analysis['perturbed_paths_found'] else "✗ MISSED"
                                f.write(f"{detected_status}: {perturbed_path}\n")
                                f.write(f"  Target Event (ID={self.cible_id}) - PERTURBED VALUE:\n")
                                
                                perturbed_payload = self.final_perturbed_payload.get(self.cible_id, "")
                                found = False
                                for line in perturbed_payload.splitlines():
                                    if perturbed_path in line:
                                        f.write(f"    {line}\n")
                                        found = True
                                        break
                                
                                if not found:
                                    f.write(f"    {perturbed_path}: [PERTURBED - Value not in output or empty]\n")
                                
                                f.write(f"  Similar Events:\n")
                                for sim_id in self.similar_ids:
                                    sim_contrib = self.contributions.get(sim_id, "")
                                    for line in sim_contrib.splitlines():
                                        if perturbed_path in line:
                                            f.write(f"    ID={sim_id}: {line}\n")
                                            break
                                
                                f.write("\n")

                        with open(response_log_path, "a", encoding="utf-8") as f:
                            f.write(f"Total tokens used: {resp.usage.total_tokens}\n\n") 
                            f.write(f"number of iterations: {iter}\n\n")

                        return json.dumps(result_obj, ensure_ascii=False, indent=2), resp.usage.total_tokens, iter 

                continue


            content = (msg.content or "").strip()
            if content:
                return "ERROR: unexpected content from LLM without tool_calls:\n" + content, resp.usage.total_tokens, iter 


            return 'ERROR: no tool_calls and empty content from LLM', resp.usage.total_tokens, iter 


# ====================================================
#
# Path provider LLM
#
# ====================================================
class LlmPathProvider:

    def __init__(self, modele: str = "openai/gpt-oss-20b", api_key:str="",base_url:str="") -> None:

        self.client = wrap_openai(OpenAI(
            api_key=api_key,
            base_url=base_url,
        ))

        self.model = modele


    def provide_path(self,description: str, paths: List[str]) -> List[str]:
        if not paths:
            return []

        paths_list_str = "\n".join(f"- {p}" for p in paths)

        prompt = PROMPT_FORMAT_PATHS_TEMPLATE.format(
            description=description,
            paths_list=paths_list_str,
        )

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            tools=TOOLS_PROVIDER,
            tool_choice={"type": "function", "function": {"name": "format_paths"}},
        )

        choice = resp.choices[0]
        msg = choice.message

        tool_calls = getattr(msg, "tool_calls", None)
        if not tool_calls:
            return []

        tc = tool_calls[0]
        if tc.function.name != "format_paths":
            return []

        try:
            args = json.loads(tc.function.arguments)
        except Exception:
            return []

        raw_paths = args.get("paths", [])
        if not isinstance(raw_paths, list):
            return []

        raw_set = set(raw_paths)
        selected_paths = [p for p in paths if p in raw_set]

        return selected_paths
    

    def provide_groups(self, t_batch: str, t_id: int, groups: dict[int, str]) -> Dict[int, List[str]]:
        selected_groups: Dict[int, List[str]] = {}

        for sim_event_id, sim_group_str in groups.items():
            prompt = PROMPT_FORMAT_GROUPS_TEMPLATE.format(
                target_batch=t_batch,
                sim_event_id=sim_event_id,
                sim_event_groups=sim_group_str
            )

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                tools=TOOLS_PROVIDER,
                tool_choice={"type": "function", "function": {"name": "format_groups"}},
            )

            choice = resp.choices[0]
            msg = choice.message

            tool_calls = getattr(msg, "tool_calls", None)
            if not tool_calls:
                selected_groups[sim_event_id] = []
                continue

            tc = tool_calls[0]
            if tc.function.name != "format_groups":
                selected_groups[sim_event_id] = []
                continue

            try:
                args = json.loads(tc.function.arguments)
            except Exception:
                selected_groups[sim_event_id] = []
                continue

            groups_data = args.get("groups", [])
            
            if isinstance(groups_data, list):
                selected_groups[sim_event_id] = groups_data
            else:
                selected_groups[sim_event_id] = []

        return selected_groups
