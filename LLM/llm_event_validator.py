

# libs import
from __future__ import annotations
from typing import Any, Dict, Optional, List, Tuple
import os
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
                 log_path: str = "") -> None:


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
        # Structure: Dict[iteration_number, List[str]] -> list of perturbed paths
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


    def build_payload_for_summarized_modules(self) -> Dict[str, Dict[int, List[str]]]:
        """  
        Pour les modules Prices, PriceGroups, RightToSellAndFees:
        - Traite la contribution en lots de 5 lignes
        - Si moins de 5 lignes au total ou restantes, envoie directement
        
        Returns:
            Dict[batch_contribution -> Dict[event_id -> list de groupes sélectionnés]]
        """
        module_id = self.module_id
        cible_id = self.cible_id
        similar_ids = self.similar_ids

        cible_contribution = self.contributions.get(cible_id, "")
        sim_groups: dict[int, str] = {}
        for eid in similar_ids:
            sim_groups[eid] = self.contributions.get(eid, "")

        cible_lines = cible_contribution.splitlines()
        # Traiter par lots de 5 lignes
        batch_size = 5
        batches = []
        
        for i in range(0, len(cible_lines), batch_size):
            batch = cible_lines[i:i + batch_size]
            batches.append("\n".join(batch))
        
        # Traiter chaque lot
        payload: Dict[str, Dict[int, List[str]]] = {}
        for batch_idx, batch_contribution in enumerate(batches):
            relevant_groups = self.path_provider.provide_groups(t_batch=batch_contribution, t_id=cible_id, groups=sim_groups)  
            payload[batch_contribution] = relevant_groups
        return payload


    def set_policy(self, policy: str) -> None:
        """Définit la policy textuelle (preamble) à passer au LLM pour CE module."""
        self.policy = (policy or "").strip() or None
    
    
    def _extract_paths_from_perturbed(self, perturbed: Dict[int, str]) -> List[str]:
        """
        Extract all paths from the perturbed dict.
        Each entry is in format "path: value", extract just the path.
        
        Args:
            perturbed: Dict[index, "path: value"] from inject_perturbation
            
        Returns:
            List of paths that were perturbed
        """
        paths = []
        for line in perturbed.values():
            # Format: "path: value"
            if ": " in line:
                path = line.split(": ", 1)[0]
                paths.append(path)
        return paths
    
    
    def _compute_confusion_matrix(self, llm_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compute confusion matrix based on perturbed paths and LLM-detected issues.
        
        Args:
            llm_issues: List of issues detected by LLM (from format_issues)
            
        Returns:
            Dict containing:
            - confusion_matrix: TP, FP, TN, FN counts
            - perturbed_paths_analysis: which perturbed paths were found/missed
            - all_detected_paths: all paths mentioned in issues
        """
        # Flatten all perturbed paths across all iterations
        all_perturbed_paths = set()
        for paths_list in self.perturbed_memory.values():
            all_perturbed_paths.update(paths_list)
        
        # Extract paths from LLM issues
        detected_paths = set()
        for issue in llm_issues:
            if isinstance(issue, dict) and "path" in issue:
                detected_paths.add(issue["path"])
        
        # Compute confusion matrix
        # TP: perturbed paths that were detected
        true_positives = all_perturbed_paths & detected_paths
        
        # FP: detected paths that were NOT perturbed
        false_positives = detected_paths - all_perturbed_paths
        
        # FN: perturbed paths that were NOT detected
        false_negatives = all_perturbed_paths - detected_paths
        
        # TN: paths not perturbed and not detected (we don't track all possible paths, so TN = 0)
        true_negatives = 0
        
        confusion_matrix = {
            "TP": len(true_positives),
            "FP": len(false_positives),
            "FN": len(false_negatives),
            "TN": true_negatives,
        }
        
        # Calculate metrics
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
        """
        Pour une description donnée, récupère tous les paths du module,
        utilise LlmPathProvider pour sélectionner les paths pertinents,
        puis récupère les valeurs correspondantes dans l'event cible et les events similaires,
        en injectant des erreurs dans les valeurs de l'event cible.
        """
        module_id = self.module_id
        cible_id = self.cible_id
        similar_ids = self.similar_ids

        cible_contribution = self.contributions.get(cible_id, "")
        
        # Traitement standard pour les autres modules
        all_paths = extract_path_from_contribution(cible_contribution)
        relevant_paths = self.path_provider.provide_path(description=description, paths=all_paths)
        
        payload: Dict[int, str] = {}
        for eid in [cible_id] + similar_ids:
            contribution = self.contributions.get(eid, "")
            path_value_str = build_path_value_from_paths(contribution, relevant_paths)
            payload[eid] = path_value_str
        
        return payload


    def validate_section(self) -> Tuple[str, int, int]:
        """
        Lance la validation LLM pour CE module.
        Retourne la sortie JSON formatée en string.
        """

        module_id = self.module_id

        prompt_log_path = os.path.join(self.log_path, f"prompts.txt")
        os.makedirs(os.path.dirname(prompt_log_path), exist_ok=True)

        response_log_path = os.path.join(self.log_path, f"responses.txt")
        os.makedirs(os.path.dirname(response_log_path), exist_ok=True)

        performance_log_path =  os.path.join(self.log_path, f"performance.txt")
        os.makedirs(os.path.dirname(performance_log_path), exist_ok=True)

        perturbations_log_path =  os.path.join(self.log_path, f"perturbations.txt")
        os.makedirs(os.path.dirname(perturbations_log_path), exist_ok=True)

        # Messages à envoyer
        messages = [
            {"role": "system", "content": self.system_message},
            {"role": "user", "content": self.policy},
            {"role": "user", "content": self.first_user_message},
        ]

        iter=1

        while True:

            # Appel au LLM avec tools
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0,
                tools=TOOLS_VALIDATOR,
                tool_choice="auto",  # le modèle choisit get_event_field ou format_issues
            )

            choice = resp.choices[0]
            msg = choice.message


            # Cas 1 : le modèle appelle un ou plusieurs tools
            tool_calls = getattr(msg, "tool_calls", None)
            if tool_calls:
                # On garde l'assistant + ses tool_calls dans l'historique
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

                        # Gestion des modules spécialisés avec payload pré-construit
                        if module_id in ["Prices", "PriceGroups", "RightToSellAndFees"]:
                            if self.payload is not None and self.payload_iterator < len(self.payload_keys):
                                # Récupérer l'élément suivant du payload
                                current_key = self.payload_keys[self.payload_iterator]
                                payload = {current_key: self.payload[current_key]}
                                
                                # Calculer et logger les statistiques de progression
                                groups_sent = self.payload_iterator + 1
                                groups_remaining = len(self.payload_keys) - groups_sent
                                total_groups = len(self.payload_keys)
                                progress_info = f"Batch {groups_sent}/{total_groups} | Remaining: {groups_remaining}"
                                
                                self.payload_iterator += 1
                            else:
                                # Pas d'élément restant ou payload vide
                                payload = {}
                                progress_info = "All batches processed"
                        else:
                            # Traitement standard pour les autres modules
                            payload = self._handle_get_event_field(description=description)
                            progress_info = None

                        with open(prompt_log_path, "a", encoding="utf-8") as f:
                            f.write(f"Payload returned:\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n")
                            if progress_info:
                                f.write(f"Progress: {progress_info}\n")
                            f.write("\n")

                        #########################
                        #  Inject Perturbations
                        #########################
                        original_block = payload.get(self.cible_id, "")  # type: ignore
                        
                        # Count the number of attributes (lines) in the block
                        # Each valid line is in format "path: value"
                        block_lines = [line.strip() for line in original_block.splitlines() if line.strip()]
                        num_attributes = len(block_lines)
                        
                        # min_attributes is at least 1, max_attributes is all attributes
                        min_attrs = max(1, min(num_attributes, 1))
                        max_attrs = max(1, num_attributes)
                        
                        original, perturbed, block = self.perturbation_engine.inject_perturbation(
                            block=original_block,
                            min_attributes=min_attrs,
                            max_attributes=max_attrs
                        )
                        
                        # Store perturbed paths in memory for confusion matrix later
                        perturbed_paths = self._extract_paths_from_perturbed(perturbed)
                        self.perturbed_memory[iter] = perturbed_paths
                        
                        # Update the payload with the perturbed block
                        payload[self.cible_id] = block  # type: ignore
                        
                        # Store the final perturbed payload for detailed analysis
                        self.final_perturbed_payload[self.cible_id] = block

                        with open(perturbations_log_path, "a", encoding="utf-8") as f:
                            f.write(f"--- Iteration {iter} ---\n\n")
                            f.write(f"Original Block:\n{json.dumps(original, ensure_ascii=False, indent=2)}\n")
                            f.write(f"Perturbed Block:\n{json.dumps(perturbed, ensure_ascii=False, indent=2)}\n")
                            f.write("\n")

                        # On renvoie le résultat du tool au modèle
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": "get_event_field",
                            "content": json.dumps(payload, ensure_ascii=False),
                        })

                        # On laisse la boucle continuer : nouveau tour → le modèle pourra
                        # soit redemander get_event_field, soit appeler format_issues.
                        iter += 1
                        continue

                    elif name == "format_issues":

                        with open(response_log_path, "a", encoding="utf-8") as f:
                            f.write(f"--- Iteration {iter} ---\n")
                            f.write(f"Format issues called with args:\n{json.dumps(args, ensure_ascii=False, indent=2)}\n\n")
                        # Ici, on considère que c'est la réponse finale.
                        result_obj = args

                        # Compute confusion matrix based on perturbed paths and detected issues
                        llm_issues = args.get("issues", [])
                        confusion_analysis = self._compute_confusion_matrix(llm_issues)
                        
                        # Write performance metrics and confusion matrix
                        with open(performance_log_path, "a", encoding="utf-8") as f:
                            f.write("="*80 + "\n")
                            f.write("CONFUSION MATRIX ANALYSIS\n")
                            f.write("="*80 + "\n\n")
                            
                            # Write confusion matrix
                            cm = confusion_analysis["confusion_matrix"]
                            f.write("Confusion Matrix:\n")
                            f.write(f"  True Positives (TP):  {cm['TP']}  (perturbed paths detected)\n")
                            f.write(f"  False Positives (FP): {cm['FP']}  (non-perturbed paths detected)\n")
                            f.write(f"  False Negatives (FN): {cm['FN']}  (perturbed paths missed)\n")
                            f.write(f"  True Negatives (TN):  {cm['TN']}\n\n")
                            
                            # Write metrics
                            metrics = confusion_analysis["metrics"]
                            f.write("Performance Metrics:\n")
                            f.write(f"  Precision: {metrics['precision']:.4f}  (of detected issues, how many were actually perturbed)\n")
                            f.write(f"  Recall:    {metrics['recall']:.4f}  (of perturbed paths, how many were detected)\n")
                            f.write(f"  Accuracy:  {metrics['accuracy']:.4f}  (overall correctness)\n\n")
                            
                            # Write perturbed paths analysis
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
                            
                            # Write detailed perturbed paths analysis with similar events context
                            f.write("="*80 + "\n")
                            f.write("DETAILED PERTURBED PATHS WITH CONTEXT\n")
                            f.write("="*80 + "\n\n")
                            
                            for perturbed_path in confusion_analysis['all_perturbed_paths']:
                                detected_status = "✓ DETECTED" if perturbed_path in analysis['perturbed_paths_found'] else "✗ MISSED"
                                f.write(f"{detected_status}: {perturbed_path}\n")
                                f.write(f"  Target Event (ID={self.cible_id}) - PERTURBED VALUE:\n")
                                
                                # Get the perturbed value from the final perturbed payload
                                perturbed_payload = self.final_perturbed_payload.get(self.cible_id, "")
                                found = False
                                for line in perturbed_payload.splitlines():
                                    if perturbed_path in line:
                                        f.write(f"    {line}\n")
                                        found = True
                                        break
                                
                                # If not found in payload, it might be because the value was emptied/perturbed
                                # In that case, show that it was perturbed to an empty/missing value
                                if not found:
                                    f.write(f"    {perturbed_path}: [PERTURBED - Value not in output or empty]\n")
                                
                                # Show similar events values for comparison
                                f.write(f"  Similar Events:\n")
                                for sim_id in self.similar_ids:
                                    sim_contrib = self.contributions.get(sim_id, "")
                                    for line in sim_contrib.splitlines():
                                        if perturbed_path in line:
                                            f.write(f"    ID={sim_id}: {line}\n")
                                            break
                                
                                f.write("\n")

                        with open(response_log_path, "a", encoding="utf-8") as f:
                            f.write(f"Total tokens used: {resp.usage.total_tokens}\n\n") #type: ignore
                            f.write(f"number of iterations: {iter}\n\n")

                        # return response, num_tokens_used, num_iterations
                        return json.dumps(result_obj, ensure_ascii=False, indent=2), resp.usage.total_tokens, iter # type: ignore

                # Si on a traité tous les tool_calls sans format_output,
                # la boucle repart pour un nouvel appel LLM.
                continue


            # Cas 2 : pas de tool_call → soit le modèle a répondu en texte brut, soit c'est une erreur
            content = (msg.content or "").strip()
            if content:
                # Tu peux décider ici :
                # - soit d'essayer de parser content comme JSON,
                # - soit de le logger comme erreur.
                return "ERROR: unexpected content from LLM without tool_calls:\n" + content, resp.usage.total_tokens, iter # type: ignore


            # Cas 3 : rien du tout → on sort avec une erreur
            return 'ERROR: no tool_calls and empty content from LLM', resp.usage.total_tokens, iter # type: ignore


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
        """Pour un texte de description et une liste de paths possibles,
        retourne la liste des paths pertinents selon le LLM.
        """

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

        # On s'attend à ce que le modèle appelle format_paths
        tool_calls = getattr(msg, "tool_calls", None)
        if not tool_calls:
            # Fallback : rien reçu → on retourne une liste vide
            return []

        tc = tool_calls[0]
        if tc.function.name != "format_paths":
            # Fallback : ce ne devrait jamais arriver vu tool_choice, mais on sécurise
            return []

        try:
            args = json.loads(tc.function.arguments)
        except Exception:
            return []

        raw_paths = args.get("paths", [])
        if not isinstance(raw_paths, list):
            return []

        # On sécurise : on garde uniquement les paths qui faisaient partie de la liste d'entrée
        raw_set = set(raw_paths)
        selected_paths = [p for p in paths if p in raw_set]

        return selected_paths
    

    def provide_groups(self, t_batch: str, t_id: int, groups: dict[int, str]) -> Dict[int, List[str]]:
        """
        Pour un lot cible et une liste de groupes similaires,
        retourne les groupes pertinents selon le LLM.
        Traite chaque événement similaire dans une requête LLM séparée pour réduire les tokens.
        
        Args:
            t_batch: Le lot cible (string de groupes)
            t_id: L'ID de l'event cible
            groups: Dict[event_id -> string de groupes] pour les événements similaires
            
        Returns:
            Dict[event_id -> liste de groupes sélectionnés (strings)]
        """
        selected_groups: Dict[int, List[str]] = {}

        # Traiter chaque événement similaire dans une requête séparée
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

            # On s'attend à ce que le modèle appelle format_groups
            tool_calls = getattr(msg, "tool_calls", None)
            if not tool_calls:
                # Fallback : rien reçu → on retourne une liste vide pour cet événement
                selected_groups[sim_event_id] = []
                continue

            tc = tool_calls[0]
            if tc.function.name != "format_groups":
                # Fallback : ce ne devrait jamais arriver vu tool_choice, mais on sécurise
                selected_groups[sim_event_id] = []
                continue

            try:
                args = json.loads(tc.function.arguments)
            except Exception:
                selected_groups[sim_event_id] = []
                continue

            # On s'attend à ce que args contienne les groupes sélectionnés
            # Structure : {"groups": [group_string1, group_string2, ...]}
            groups_data = args.get("groups", [])
            
            # Valider que c'est une liste
            if isinstance(groups_data, list):
                selected_groups[sim_event_id] = groups_data
            else:
                selected_groups[sim_event_id] = []

        return selected_groups