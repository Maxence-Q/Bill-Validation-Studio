

# libs import
from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional, List, Tuple
import os
import json, textwrap
from openai import OpenAI
from langsmith.wrappers import wrap_openai

# files import
from LLM.tools import *
from LLM.tools_en import *
from utils.event_validator_helper import *
from tests.test_perturbation.perturbation_engine import PerturbationEngine


class LlmEventValidator:
    def __init__(self, model: str = "openai/gpt-oss-120b",
                 api_key: str="",
                 module_id: str = "Event", 
                 cible_id: int = 0, 
                 sim_ids: list[int] = [], 
                 contributions: dict[int,Any]={},
                 log_path: str = "",
                 run_config: Dict[str, Any] = {}) -> None:


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
        self.model = model
        self.temperature = run_config.get("temperature", 0.0)
        self.language = run_config.get("language", "fr")

        self.path_provider = LlmPathProvider(modele="openai/gpt-oss-120b", api_key=api_key, base_url=base_url, language=self.language)

        self.perturbation_engine = PerturbationEngine()
        self.stats: Dict[str,int] = {}

        self.module_id: str = module_id
        self.cible_id: int = cible_id
        self.similar_ids: list[int] = sim_ids
        self.contributions: dict[int,Any] = contributions

        self.payload: Optional[Dict[str, Dict[int, List[str]]]] = None

        self.log_path: str = log_path

        # Select language-specific constants
        if self.language == "en":
            self.system_message: str = SYSTEM_MESSAGE_EN
            self.validate_section_prompt_template: str = VALIDATE_SECTION_PROMPT_EN
            self.validate_section_spec_prompt_template: str = VALIDATE_SECTION_SPEC_PROMPT_EN
            self.tools_validator = TOOLS_VALIDATOR_EN
            self.tools_provider = TOOLS_PROVIDER_EN
            self.prompt_paths_template = PROMPT_FORMAT_PATHS_TEMPLATE_EN
        else:
            self.system_message: str = SYSTEM_MESSAGE_FR
            self.validate_section_prompt_template: str = VALIDATE_SECTION_PROMPT_FR
            self.validate_section_spec_prompt_template: str = VALIDATE_SECTION_SPEC_PROMPT_FR
            self.tools_validator = TOOLS_VALIDATOR_FR
            self.tools_provider = TOOLS_PROVIDER_FR
            self.prompt_paths_template = PROMPT_FORMAT_PATHS_TEMPLATE_FR

        self.policy: Dict[str,Any] = {}
        # cases of plural policies
        self.policies: Dict[str,Dict[str,Any]] = {}

        self.run_config: Dict[str, Any] = run_config
        
        # Perturbed memory: tracks which paths were perturbed in each iteration
        # Structure: Dict[iteration_number, List[str]] -> list of perturbed paths
        self.perturbed_memory: Dict[int, List[str]] = {}
        
        # Store perturbed paths WITH their values for precise matching in reports
        # Structure: Dict[iteration_number, Dict[path, perturbed_value]]
        self.perturbed_memory_with_values: Dict[int, Dict[str, str]] = {}
        
        # Store the final perturbed payload sent to LLM (for detailed analysis)
        self.final_perturbed_payload: Dict[int, str] = {}


    def set_policy(self, policy: Dict[str,Any] = {}, policies: Dict[str,Dict[str,Any]] = {}) -> None:
        """Définit la policy textuelle (preamble) à passer au LLM pour CE module."""
        if policies:
            self.policies = policies
        else:
            self.policy = policy
    
    
    def _extract_paths_from_perturbed(self, perturbed: Dict[int, str]) -> Tuple[List[str], Dict[str, str]]:
        """
        Extract all paths from the perturbed dict along with their perturbed values.
        Each entry is in format "path: value", extract both path and value.
        
        Args:
            perturbed: Dict[index, "path: value"] from inject_perturbation
            
        Returns:
            Tuple containing:
            - List of paths that were perturbed
            - Dict mapping path -> perturbed_value for precise matching
        """
        paths = []
        paths_with_values = {}
        for line in perturbed.values():
            # Format: "path: value"
            if ": " in line:
                path, value = line.split(": ", 1)
                paths.append(path)
                paths_with_values[path] = value
        return paths, paths_with_values
    
    
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

    
    def _get_event_field_from_desc(self, description: str) -> Dict[int, str]:
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
            Exécute la validation séquentielle basée sur la policy.
            Pour chaque point de contrôle (check) :
            1. Récupère les données pertinentes via PathProvider.
            2. Injecte des perturbations.
            3. Interroge le LLM pour valider ce point précis.
            4. Agrège les anomalies.
        """

        module_id = self.module_id

        # Préparation des logs
        prompt_log_path = os.path.join(self.log_path, f"prompts.txt")
        response_log_path = os.path.join(self.log_path, f"responses.txt")
        performance_log_path = os.path.join(self.log_path, f"performance.txt")
        perturbations_log_path = os.path.join(self.log_path, f"perturbations.txt")
        coverage_log_path = os.path.join(self.log_path, f"coverage.txt")

        for path in [prompt_log_path, response_log_path, performance_log_path, perturbations_log_path,coverage_log_path]:
            os.makedirs(os.path.dirname(path), exist_ok=True)

        total_tokens = 0
        all_issues: List[Dict[str, Any]] = []

        # Pour stocker le bloc de texte perturbé spécifique à chaque itération
        # Key: iteration number, Value: The perturbed text block sent to LLM
        iteration_payloads: Dict[int, str] = {}

        # Pour la couverture (Set pour éviter les doublons)
        covered_attributes: set[str] = set()

        # Reset memory for this run
        self.perturbed_memory = {}
        self.perturbed_memory_with_values = {}
        
        # Récupération de la liste des checks (assumant que set_policy a bien été appelé avec la nouvelle structure)
        checks = self.policy.get('checks', [])
        policy_intro = self.policy.get('policy_intro', "")


        # On itère sur chaque point de contrôle
        for i, check in enumerate(checks, 1):
            check_name = check.get('name', f"Check {i}")
            instruction = check.get('instruction', "")

            # ---------------------------------------------------------
            # 1. Récupération Programmatique des Données
            # ---------------------------------------------------------
            # On utilise l'instruction comme description pour le PathProvider
            try:
                payload = self._get_event_field_from_desc(description=instruction)
            except Exception as e:
                # Fallback si la récupération échoue
                payload = {self.cible_id: f"Error retrieving data: {str(e)}"}

            # --- 1-bis. Collecte de couverture ---
            # On regarde quelles données ont été remontées pour la cible avant perturbation
            target_raw_data = payload.get(self.cible_id, "")
            if target_raw_data:
                for line in target_raw_data.splitlines():
                    line = line.strip()
                    # On assume le format "Chemin: Valeur"
                    if ": " in line:
                        path_extracted = line.split(": ", 1)[0]
                        covered_attributes.add(path_extracted)

            # ---------------------------------------------------------
            # 2. Injection de Perturbations
            # ---------------------------------------------------------
            original_block = payload.get(self.cible_id, "")
            
            # Calcul du nombre d'attributs pour calibrer la perturbation
            block_lines = [line.strip() for line in original_block.splitlines() if line.strip()]
            num_attributes = len(block_lines)
            min_attrs = max(1, min(num_attributes, 1))
            max_attrs = max(1, num_attributes)

            # Injection
            original, perturbed, block = self.perturbation_engine.inject_perturbation(
                block=original_block,
                min_attributes=min_attrs,
                max_attributes=max_attrs
            )

            # Mise à jour de la mémoire pour la matrice de confusion
            # i correspond au numéro de l'itération/check
            perturbed_paths, perturbed_values = self._extract_paths_from_perturbed(perturbed)
            self.perturbed_memory[i] = perturbed_paths
            self.perturbed_memory_with_values[i] = perturbed_values
            iteration_payloads[i] = block
            
            # Mise à jour du payload avec la version perturbée
            payload[self.cible_id] = block
            self.final_perturbed_payload[self.cible_id] = block # Keep latest for debug

            # Log des perturbations
            with open(perturbations_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Check {i}: {check_name} ---\n")
                f.write(f"Original Block:\n{json.dumps(original, ensure_ascii=False, indent=2)}\n")
                f.write(f"Perturbed Block:\n{json.dumps(perturbed, ensure_ascii=False, indent=2)}\n\n")


            # ---------------------------------------------------------
            # Préparation des données pour le prompt
            # ---------------------------------------------------------
            
            # On extrait le contenu de la cible (string)
            target_content = payload.get(self.cible_id, "Données non disponibles")
            
            # On crée un dictionnaire contenant UNIQUEMENT les similaires
            # (On exclut la clé self.cible_id)
            similar_content = {k: v for k, v in payload.items() if k != self.cible_id}
            
            # ---------------------------------------------------------
            # 3. Appel au LLM Validator
            # ---------------------------------------------------------
            # Construction du prompt isolé pour cette étape using template
            step_prompt = self.validate_section_prompt_template.format(
                policy_intro=policy_intro,
                check_num=i,
                total_checks=len(checks),
                check_name=check_name,
                instruction=instruction,
                cible_id=self.cible_id,
                target_content=target_content,
                similar_content=json.dumps(similar_content, ensure_ascii=False, indent=2)
            )

            messages = [
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": step_prompt}
            ]

            # Log du prompt
            with open(prompt_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Check {i}: {check_name} ---\n")
                f.write(step_prompt + "\n\n")

            # Appel API
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                tools=self.tools_validator, 
                tool_choice={"type": "function", "function": {"name": "report_step_issues"}}, 
            )

            total_tokens += resp.usage.total_tokens
            choice = resp.choices[0]
            msg = choice.message
            tool_calls = getattr(msg, "tool_calls", None)

            # ---------------------------------------------------------
            # 4. Traitement de la réponse
            # ---------------------------------------------------------
            step_issues = []
            if tool_calls:
                for tc in tool_calls:
                    if tc.function.name == "report_step_issues":
                        try:
                            args = json.loads(tc.function.arguments)
                            step_issues = args.get("issues", [])
                            # On ajoute les issues trouvées à la liste globale
                            all_issues.extend(step_issues)
                        except json.JSONDecodeError:
                            pass # Erreur de parsing, on ignore ou on log

            # Log de la réponse
            with open(response_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Check {i}: {check_name} ---\n")
                f.write(f"Issues found: {json.dumps(step_issues, ensure_ascii=False, indent=2)}\n\n")

        # Fin de la boucle sur les checks

        # ==============================================================================
        # 5. STATISTIQUES DE PERTURBATIONS
        # ==============================================================================

        self.stats = self.perturbation_engine.get_stats()

        # ==============================================================================
        # 6. RAPPORT DE COUVERTURE (Coverage)
        # ==============================================================================
        with open(coverage_log_path, "w", encoding="utf-8") as f:
            f.write(f"Module: {module_id}\n")
            f.write(f"Total Unique Attributes Covered: {len(covered_attributes)}\n")
            f.write("="*80 + "\n\n")
            # Tri alphabétique pour la lisibilité
            for attr in sorted(covered_attributes):
                f.write(f"{attr}\n")

        # ==============================================================================
        # 7. RAPPORT FINAL & ANALYSE DE PERFORMANCE
        # ==============================================================================
        
        # 1. Calculer les métriques globales (sur toutes les étapes)
        confusion_analysis = self._compute_confusion_matrix(all_issues)
        
        with open(performance_log_path, "a", encoding="utf-8") as f:
            # En-tête statistiques
            f.write("="*80 + "\n")
            f.write("GLOBAL CONFUSION MATRIX ANALYSIS\n")
            f.write("="*80 + "\n\n")
            
            cm = confusion_analysis["confusion_matrix"]
            metrics = confusion_analysis["metrics"]
            
            f.write(f"True Positives (TP):  {cm['TP']} (Perturbations detected)\n")
            f.write(f"False Positives (FP): {cm['FP']} (Hallucinations?)\n")
            f.write(f"False Negatives (FN): {cm['FN']} (Perturbations missed)\n")
            f.write(f"\nPrecision: {metrics['precision']:.4f}\n")
            f.write(f"Recall:    {metrics['recall']:.4f}\n")
            f.write(f"Accuracy:  {metrics['accuracy']:.4f}\n\n")
            f.write(f"Total tokens used: {total_tokens}\n")
            f.write("="*80 + "\n\n")

            # 2. Rapport Détaillé Path par Path
            f.write("DETAILED PERTURBED PATHS WITH CONTEXT\n")
            f.write("="*80 + "\n\n")

            analysis = confusion_analysis["perturbed_analysis"]
            found_paths_set = set(analysis['perturbed_paths_found'])

            # On itère sur l'historique pour garder l'ordre chronologique des checks
            for iter_num, paths in self.perturbed_memory.items():
                
                # Le bloc de texte perturbé qui a été envoyé à CETTE étape
                iter_block = iteration_payloads.get(iter_num, "")
                
                # Récupère aussi les valeurs perturbées pour ce matching précis
                paths_values = self.perturbed_memory_with_values.get(iter_num, {})
                
                for perturbed_path in paths:
                    detected_status = "✓ DETECTED" if perturbed_path in found_paths_set else "✗ MISSED"
                    
                    f.write(f"{detected_status} [Iter {iter_num}]: {perturbed_path}\n")
                    
                    # A. Valeur Perturbée (Celle vue par le LLM à ce moment précis)
                    f.write(f"  Target (PERTURBED):\n")
                    found_in_target = False
                    
                    # Récupère la valeur perturbée pour ce path
                    perturbed_value = paths_values.get(perturbed_path, "")
                    
                    # Matching précis: cherche "path: perturbed_value"
                    target_line = f"{perturbed_path}: {perturbed_value}"
                    for line in iter_block.splitlines():
                        if line.strip() == target_line.strip():
                            f.write(f"    {line.strip()}\n")
                            found_in_target = True
                            break
                    
                    if not found_in_target:
                        f.write(f"    [Value not found in payload block]\n")

                    # B. Valeurs de Référence (Similaires)
                    # On va chercher dans les contributions globales (car elles ne changent pas)
                    f.write(f"  Similar Events (References):\n")
                    for sim_id in self.similar_ids:
                        sim_contrib = self.contributions.get(sim_id, "")
                        found_in_sim = False
                        for line in sim_contrib.splitlines():
                            if perturbed_path in line:
                                f.write(f"    ID={sim_id}: {line.strip()}\n")
                                found_in_sim = True
                                break
                    
                    f.write("\n")

        # Formatage du résultat final pour le ModuleManager
        final_result = {
            "module_id": module_id,
            "status": "error" if any(i.get('severity') == 'error' for i in all_issues) else ("warning" if all_issues else "ok"),
            "issues": all_issues
        }

        return json.dumps(final_result, ensure_ascii=False, indent=2), total_tokens, len(checks)


    def validate_section_spec(self) -> Tuple[str, int, int]:
        """
            Exécute la validation séquentielle des listes de massive data.
            Pour chaque élément de la liste :
            1. À venir
            2. À venir 
            3. Interroge le LLM pour valider cet élément précis.
            4. Agrège les anomalies.
        """

        module_id = self.module_id

        # Préparation des logs
        prompt_log_path = os.path.join(self.log_path, f"prompts.txt")
        response_log_path = os.path.join(self.log_path, f"responses.txt")
        performance_log_path = os.path.join(self.log_path, f"performance.txt")
        perturbations_log_path = os.path.join(self.log_path, f"perturbations.txt")
        coverage_log_path = os.path.join(self.log_path, f"coverage.txt")

        for path in [prompt_log_path, response_log_path, performance_log_path, perturbations_log_path,coverage_log_path]:
            os.makedirs(os.path.dirname(path), exist_ok=True)

        total_tokens = 0
        all_issues: List[Dict[str, Any]] = []

        # Pour stocker le bloc de texte perturbé spécifique à chaque itération
        # Key: iteration number, Value: The perturbed text block sent to LLM
        iteration_payloads: Dict[int, str] = {}

        # Pour la couverture (Set pour éviter les doublons)
        covered_attributes: set[str] = set()

        # Reset memory for this run
        self.perturbed_memory = {}
        self.perturbed_memory_with_values = {}
        
        # Récupération de la liste des checks (assumant que set_policy a bien été appelé avec la nouvelle structure)
        checks = self.policy.get('checks', [])
        policy_intro = self.policy.get('policy_intro', "")

        # ---------------------------------------------------------
        # On crée un dictionnaire contenant UNIQUEMENT les similaires
        # dépendammet du module, le nombre de similaires diffèrent
        # ---------------------------------------------------------
        similar_events_use = {}
        if self.module_id == "Prices":
            similar_events_use= self.contributions[self.similar_ids[0]]
        elif self.module_id == "PriceGroups":
            similar_events_use = {
                self.similar_ids[0]: self.contributions[self.similar_ids[0]],
                self.similar_ids[1]: self.contributions[self.similar_ids[1]],
            }
        elif self.module_id == "RightToSellAndFees":
            similar_events_use = {"Pas besoin de similaires pour ce module": ""}

        i = 0
        # ---------------------------------------------------------
        # On itère sur chaque élément de la contribution (liste)
        # ---------------------------------------------------------
        for data_element in self.contributions[self.cible_id]:
            
            i += 1

            # ---------------------------------------------------------
            # Préparation des données pour le prompt
            # ---------------------------------------------------------
            
            similar_content = {}
            
            # ---------------------------------------------------------
            # 3. Appel au LLM Validator
            # ---------------------------------------------------------
            # Construction du prompt isolé pour cette étape
            step_prompt = self.validate_section_spec_prompt_template.format(
                element_num=i,
                total_elements=len(self.contributions[self.cible_id]),
                policy_intro=policy_intro,
                cible_id=self.cible_id,
                data_element=data_element
            )

            messages = [
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": step_prompt}
            ]

            # Log du prompt
            with open(prompt_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Élément {i} ---\n")
                f.write(step_prompt + "\n\n")

            # Appel API
            # Note: On assume ici que tools_validator contient désormais tool_report_step_issues
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                tools=self.tools_validator, 
                tool_choice={"type": "function", "function": {"name": "report_step_issues"}}, 
            )

            total_tokens += resp.usage.total_tokens
            choice = resp.choices[0]
            msg = choice.message
            tool_calls = getattr(msg, "tool_calls", None)

            # ---------------------------------------------------------
            # 4. Traitement de la réponse
            # ---------------------------------------------------------
            step_issues = []
            if tool_calls:
                for tc in tool_calls:
                    if tc.function.name == "report_step_issues":
                        try:
                            args = json.loads(tc.function.arguments)
                            step_issues = args.get("issues", [])
                            # On ajoute les issues trouvées à la liste globale
                            all_issues.extend(step_issues)
                        except json.JSONDecodeError:
                            pass # Erreur de parsing, on ignore ou on log

            # Log de la réponse
            with open(response_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Élément {i} ---\n")
                f.write(f"Issues found: {json.dumps(step_issues, ensure_ascii=False, indent=2)}\n\n")

        # Fin de la boucle sur les checks

        # Formatage du résultat final pour le ModuleManager
        final_result = {
            "module_id": module_id,
            "status": "error" if any(i.get('severity') == 'error' for i in all_issues) else ("warning" if all_issues else "ok"),
            "issues": all_issues
        }

        return json.dumps(final_result, ensure_ascii=False, indent=2), total_tokens, len(checks)


    def validate_section_with_multiple_models(self, models_keys: Dict[str,str]) -> Dict[str, Dict[str, Any]]:
        """
            Exécute la validation séquentielle basée sur la policy.
            Pour chaque point de contrôle (check) :
            1. Récupère les données pertinentes via PathProvider.
            2. Injecte des perturbations.
            3. Interroge les LLM pour valider ce point précis.
            4. Agrège les anomalies.
        """

        module_id = self.module_id

        logs_paths = {model: {} for model in models_keys.keys()}

        # Préparation des logs
        for model, _ in models_keys.items():
            log_path = self.log_path + f"/{model.replace('/', '_')}"
            response_log_path = os.path.join(log_path, f"responses.txt")
            performance_log_path = os.path.join(log_path, f"performance.txt")

            for path in [response_log_path, performance_log_path]:
                os.makedirs(os.path.dirname(path), exist_ok=True)

            logs_paths[model]['response'] = response_log_path
            logs_paths[model]['performance'] = performance_log_path

        prompt_log_path = os.path.join(self.log_path, f"prompts.txt")
        perturbations_log_path = os.path.join(self.log_path, f"perturbations.txt")
        coverage_log_path = os.path.join(self.log_path, f"coverage.txt")
        for path in [prompt_log_path, perturbations_log_path, coverage_log_path]:
                os.makedirs(os.path.dirname(path), exist_ok=True)

        # Sortie de la fonction
        output = {model: {} for model in models_keys.keys()}
        for model in models_keys.keys():
            output[model]['issues'] = []
            output[model]['tokens'] = 0
            output[model]['recalls'] = 0
            output[model]['precisions'] = 0

        # Pour stocker le bloc de texte perturbé spécifique à chaque itération
        # Key: iteration number, Value: The perturbed text block sent to LLM
        iteration_payloads: Dict[int, str] = {}

        # Pour la couverture (Set pour éviter les doublons)
        covered_attributes: set[str] = set()

        # Reset memory for this run
        self.perturbed_memory = {}
        self.perturbed_memory_with_values = {}
        
        # Récupération de la liste des checks (assumant que set_policy a bien été appelé avec la nouvelle structure)
        checks = self.policy.get('checks', [])
        policy_intro = self.policy.get('policy_intro', "")


        # On itère sur chaque point de contrôle
        for i, check in enumerate(checks, 1):
            check_name = check.get('name', f"Check {i}")
            instruction = check.get('instruction', "")

            # ---------------------------------------------------------
            # 1. Récupération Programmatique des Données
            # ---------------------------------------------------------
            # On utilise l'instruction comme description pour le PathProvider
            try:
                payload = self._get_event_field_from_desc(description=instruction)
            except Exception as e:
                # Fallback si la récupération échoue
                payload = {self.cible_id: f"Error retrieving data: {str(e)}"}

            # --- 1-bis. Collecte de couverture ---
            # On regarde quelles données ont été remontées pour la cible avant perturbation
            target_raw_data = payload.get(self.cible_id, "")
            if target_raw_data:
                for line in target_raw_data.splitlines():
                    line = line.strip()
                    # On assume le format "Chemin: Valeur"
                    if ": " in line:
                        path_extracted = line.split(": ", 1)[0]
                        covered_attributes.add(path_extracted)

            # ---------------------------------------------------------
            # 2. Injection de Perturbations
            # ---------------------------------------------------------
            original_block = payload.get(self.cible_id, "")
            
            # Calcul du nombre d'attributs pour calibrer la perturbation
            block_lines = [line.strip() for line in original_block.splitlines() if line.strip()]
            num_attributes = len(block_lines)
            min_attrs = max(1, min(num_attributes, 1))
            max_attrs = max(1, num_attributes)

            # Injection
            original, perturbed, block = self.perturbation_engine.inject_perturbation(
                block=original_block,
                min_attributes=min_attrs,
                max_attributes=max_attrs
            )

            # Mise à jour de la mémoire pour la matrice de confusion
            # i correspond au numéro de l'itération/check
            perturbed_paths, perturbed_values = self._extract_paths_from_perturbed(perturbed)
            self.perturbed_memory[i] = perturbed_paths
            self.perturbed_memory_with_values[i] = perturbed_values
            iteration_payloads[i] = block
            
            # Mise à jour du payload avec la version perturbée
            payload[self.cible_id] = block
            self.final_perturbed_payload[self.cible_id] = block # Keep latest for debug

            # Log des perturbations
            with open(perturbations_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Check {i}: {check_name} ---\n")
                f.write(f"Original Block:\n{json.dumps(original, ensure_ascii=False, indent=2)}\n")
                f.write(f"Perturbed Block:\n{json.dumps(perturbed, ensure_ascii=False, indent=2)}\n\n")

            
            # ---------------------------------------------------------
            # Préparation des données pour le prompt
            # ---------------------------------------------------------
            
            # On extrait le contenu de la cible (string)
            target_content = payload.get(self.cible_id, "Données non disponibles")
            
            # On crée un dictionnaire contenant UNIQUEMENT les similaires
            # (On exclut la clé self.cible_id)
            similar_content = {k: v for k, v in payload.items() if k != self.cible_id}
            
            # ---------------------------------------------------------
            # 3. Appel au LLM Validator
            # ---------------------------------------------------------
            # Construction du prompt isolé pour cette étape
            step_prompt = self.validate_section_prompt_template.format(
                policy_intro=policy_intro,
                check_num=i,
                total_checks=len(checks),
                check_name=check_name,
                instruction=instruction,
                cible_id=self.cible_id,
                target_content=target_content,
                similar_content=json.dumps(similar_content, ensure_ascii=False, indent=2)
            )

            messages = [
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": step_prompt}
            ]

                        # Log du prompt
            with open(prompt_log_path, "a", encoding="utf-8") as f:
                f.write(f"--- Check {i}: {check_name} ---\n")
                f.write(step_prompt + "\n\n")

            # ---------------------------------------------------------
            # Appel pour chaque modèle
            # ---------------------------------------------------------
            for model, api_key in models_keys.items():
                # Mise à jour du client pour le modèle courant
                self.client = wrap_openai(OpenAI(
                    api_key=api_key,
                    base_url="https://api.groq.com/openai/v1",
                ))
                self.model = model


                # Appel API
                # Note: On assume ici que tools_validator contient désormais tool_report_step_issues
                resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=self.temperature,
                    tools=self.tools_validator, 
                    tool_choice={"type": "function", "function": {"name": "report_step_issues"}}, 
                )

                output[model]['tokens'] += resp.usage.total_tokens
                choice = resp.choices[0]
                msg = choice.message
                tool_calls = getattr(msg, "tool_calls", None)

                # ---------------------------------------------------------
                # 4. Traitement de la réponse
                # ---------------------------------------------------------
                step_issues = []
                if tool_calls:
                    for tc in tool_calls:
                        if tc.function.name == "report_step_issues":
                            try:
                                args = json.loads(tc.function.arguments)
                                step_issues = args.get("issues", [])
                                # On ajoute les issues trouvées à la liste globale
                                output[model]['issues'].extend(step_issues)
                            except json.JSONDecodeError:
                                pass # Erreur de parsing, on ignore ou on log

                # Log de la réponse
                with open(logs_paths[model]["response"], "a", encoding="utf-8") as f:
                    f.write(f"--- Check {i}: {check_name} ---\n")
                    f.write(f"Issues found: {json.dumps(step_issues, ensure_ascii=False, indent=2)}\n\n")

        # Fin de la boucle sur les checks

        # ==============================================================================
        # 5. STATISTIQUES DE PERTURBATIONS
        # ==============================================================================

        self.stats = self.perturbation_engine.get_stats()

        # ==============================================================================
        # 6. RAPPORT DE COUVERTURE (Coverage)
        # ==============================================================================
        with open(coverage_log_path, "w", encoding="utf-8") as f:
            f.write(f"Module: {module_id}\n")
            f.write(f"Total Unique Attributes Covered: {len(covered_attributes)}\n")
            f.write("="*80 + "\n\n")
            # Tri alphabétique pour la lisibilité
            for attr in sorted(covered_attributes):
                f.write(f"{attr}\n")

        # ==============================================================================
        # 7. RAPPORT FINAL & ANALYSE DE PERFORMANCE
        # ==============================================================================

        for model, _ in models_keys.items():
        
            # 1. Calculer les métriques globales (sur toutes les étapes)
            confusion_analysis = self._compute_confusion_matrix(output[model]["issues"])
            
            with open(logs_paths[model]["performance"], "a", encoding="utf-8") as f:
                # En-tête statistiques
                f.write("="*80 + "\n")
                f.write("GLOBAL CONFUSION MATRIX ANALYSIS\n")
                f.write("="*80 + "\n\n")
                
                cm = confusion_analysis["confusion_matrix"]
                metrics = confusion_analysis["metrics"]

                # UPDATE THE OUTPUT DICTIONARY (Add these lines)
                output[model]['recalls'] = metrics['recall']
                output[model]['precisions'] = metrics['precision']
                
                f.write(f"True Positives (TP):  {cm['TP']} (Perturbations detected)\n")
                f.write(f"False Positives (FP): {cm['FP']} (Hallucinations?)\n")
                f.write(f"False Negatives (FN): {cm['FN']} (Perturbations missed)\n")
                f.write(f"\nPrecision: {metrics['precision']:.4f}\n")
                f.write(f"Recall:    {metrics['recall']:.4f}\n")
                f.write(f"Accuracy:  {metrics['accuracy']:.4f}\n\n")
                f.write(f"Total tokens used: {output[model]['tokens']}\n")
                f.write("="*80 + "\n\n")

                # 2. Rapport Détaillé Path par Path
                f.write("DETAILED PERTURBED PATHS WITH CONTEXT\n")
                f.write("="*80 + "\n\n")

                analysis = confusion_analysis["perturbed_analysis"]
                found_paths_set = set(analysis['perturbed_paths_found'])

                # On itère sur l'historique pour garder l'ordre chronologique des checks
                for iter_num, paths in self.perturbed_memory.items():
                    
                    # Le bloc de texte perturbé qui a été envoyé à CETTE étape
                    iter_block = iteration_payloads.get(iter_num, "")
                    
                    # Récupère aussi les valeurs perturbées pour ce matching précis
                    paths_values = self.perturbed_memory_with_values.get(iter_num, {})
                    
                    for perturbed_path in paths:
                        detected_status = "✓ DETECTED" if perturbed_path in found_paths_set else "✗ MISSED"
                        
                        f.write(f"{detected_status} [Iter {iter_num}]: {perturbed_path}\n")
                        
                        # A. Valeur Perturbée (Celle vue par le LLM à ce moment précis)
                        f.write(f"  Target (PERTURBED):\n")
                        found_in_target = False
                        
                        # Récupère la valeur perturbée pour ce path
                        perturbed_value = paths_values.get(perturbed_path, "")
                        
                        # Matching précis: cherche "path: perturbed_value"
                        target_line = f"{perturbed_path}: {perturbed_value}"
                        for line in iter_block.splitlines():
                            if line.strip() == target_line.strip():
                                f.write(f"    {line.strip()}\n")
                                found_in_target = True
                                break
                        
                        if not found_in_target:
                            f.write(f"    [Value not found in payload block]\n")

                        # B. Valeurs de Référence (Similaires)
                        # On va chercher dans les contributions globales (car elles ne changent pas)
                        f.write(f"  Similar Events (References):\n")
                        for sim_id in self.similar_ids:
                            sim_contrib = self.contributions.get(sim_id, "")
                            found_in_sim = False
                            for line in sim_contrib.splitlines():
                                if perturbed_path in line:
                                    f.write(f"    ID={sim_id}: {line.strip()}\n")
                                    found_in_sim = True
                                    break
                        
                        f.write("\n")

        return output


    def validate_section_with_multiple_configs_and_models(self, models_keys: Dict[str,str], grid_search: List[Dict[str, Any]]) -> Dict[int, Dict[str, Dict[str, Any]]]:
        """
            Exécute la validation séquentielle basée sur la policy.
            Pour chaque point de contrôle (check) :
            1. Récupère les données pertinentes via PathProvider.
            2. Injecte des perturbations.
            3. Interroge les LLM pour valider ce point précis.
            4. Agrège les anomalies.
        """

        module_id = self.module_id

        # Pour chaque run_config, on créer un sous-dossier /event_id_datetime_runindex"
        # qu'on doit stocker
        run_config_paths = {}

        for run_index in range(len(grid_search)):
            main_log_path = os.path.join(self.log_path, f"event{self.cible_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_run{run_index}")
            os.makedirs(main_log_path, exist_ok=True)
            run_config_paths[run_index] = {"main_log_path": main_log_path}


            config_log_path = os.path.join(main_log_path, "run_config.json")
            with open(config_log_path, "w", encoding="utf-8") as f:
                json.dump(grid_search[run_index], f, ensure_ascii=False, indent=2)

            # Préparation des logs
            for model, _ in models_keys.items():
                run_config_paths[run_index][model] = {}
                model_log_path = main_log_path + f"/{model.replace('/', '_')}"
                response_log_path = os.path.join( model_log_path,f"responses.txt")
                performance_log_path = os.path.join(model_log_path, f"performance.txt")

                for path in [response_log_path, performance_log_path]:
                    os.makedirs(os.path.dirname(path), exist_ok=True)

                run_config_paths[run_index][model]['response'] = response_log_path
                run_config_paths[run_index][model]['performance'] = performance_log_path

            prompt_log_path = os.path.join(main_log_path, f"prompts.txt")
            perturbations_log_path = os.path.join(main_log_path, f"perturbations.txt")
            coverage_log_path = os.path.join(main_log_path, f"coverage.txt")
            for path in [prompt_log_path, perturbations_log_path, coverage_log_path]:
                    os.makedirs(os.path.dirname(path), exist_ok=True)
            run_config_paths[run_index]['prompt'] = prompt_log_path
            run_config_paths[run_index]['perturbations'] = perturbations_log_path
            run_config_paths[run_index]['coverage'] = coverage_log_path

        # Sortie de la fonction
        outputs_by_config: Dict[int, Dict[str, Any]] = {idx: {model: {} for model in models_keys.keys()} for idx in range(len(grid_search))}
        for idx in range(len(grid_search)):
            for model in models_keys.keys():
                outputs_by_config[idx][model]['issues'] = []
                outputs_by_config[idx][model]['tokens'] = 0
                outputs_by_config[idx][model]['recalls'] = 0
                outputs_by_config[idx][model]['precisions'] = 0

        # Pour stocker le bloc de texte perturbé spécifique à chaque itération
        # Key: iteration number, Value: The perturbed text block sent to LLM
        iteration_payloads: Dict[int, str] = {}

        # Pour la couverture (Set pour éviter les doublons)
        covered_attributes: set[str] = set()

        # Reset memory for this run
        self.perturbed_memory = {}
        self.perturbed_memory_with_values = {}
        
        # Récupération de la liste des checks (assumant que set_policy a bien été appelé avec la nouvelle structure)
        # Nous testons désormais avec deux ou plus policies différentes
        # il faut gérer les instructions selon la policy en cours
        # seulement pour le validator, pas le path provider
        # dans le step_prompt, on donne l'instruction, mais qui justement change selon la policy
        # mais la policy_intro et le name reste pareil
        # donc au lieu de donner l'instruction obtenue par instruction = check.get('instruction', "")
        checks = self.policies[self.run_config["policy"]].get('checks', [])
        policy_intro = self.policies[self.run_config["policy"]].get('policy_intro', "")


        # On itère sur chaque point de contrôle
        for i, check in enumerate(checks, 1):
            check_name = check.get('name', f"Check {i}")
            instruction = check.get('instruction', "")

            # ---------------------------------------------------------
            # 1. Récupération Programmatique des Données
            # ---------------------------------------------------------
            # On utilise l'instruction comme description pour le PathProvider
            try:
                payload = self._get_event_field_from_desc(description=instruction)
            except Exception as e:
                # Fallback si la récupération échoue
                payload = {self.cible_id: f"Error retrieving data: {str(e)}"}

            # --- 1-bis. Collecte de couverture ---
            # On regarde quelles données ont été remontées pour la cible avant perturbation
            target_raw_data = payload.get(self.cible_id, "")
            if target_raw_data:
                for line in target_raw_data.splitlines():
                    line = line.strip()
                    # On assume le format "Chemin: Valeur"
                    if ": " in line:
                        path_extracted = line.split(": ", 1)[0]
                        covered_attributes.add(path_extracted)

            # ---------------------------------------------------------
            # 2. Injection de Perturbations
            # ---------------------------------------------------------
            original_block = payload.get(self.cible_id, "")
            
            # Calcul du nombre d'attributs pour calibrer la perturbation
            block_lines = [line.strip() for line in original_block.splitlines() if line.strip()]
            num_attributes = len(block_lines)
            min_attrs = max(1, min(num_attributes, 1))
            max_attrs = max(1, num_attributes)

            # Injection
            original, perturbed, block = self.perturbation_engine.inject_perturbation(
                block=original_block,
                min_attributes=min_attrs,
                max_attributes=max_attrs
            )

            # Mise à jour de la mémoire pour la matrice de confusion
            # i correspond au numéro de l'itération/check
            perturbed_paths, perturbed_values = self._extract_paths_from_perturbed(perturbed)
            self.perturbed_memory[i] = perturbed_paths
            self.perturbed_memory_with_values[i] = perturbed_values
            iteration_payloads[i] = block
            
            # Mise à jour du payload avec la version perturbée
            payload[self.cible_id] = block
            self.final_perturbed_payload[self.cible_id] = block # Keep latest for debug

            # Log des perturbations
            for run_index in range(len(grid_search)):
                perturbations_log_path = run_config_paths[run_index]['perturbations']
                with open(perturbations_log_path, "a", encoding="utf-8") as f:
                    f.write(f"--- Check {i}: {check_name} ---\n")
                    f.write(f"Original Block:\n{json.dumps(original, ensure_ascii=False, indent=2)}\n")
                    f.write(f"Perturbed Block:\n{json.dumps(perturbed, ensure_ascii=False, indent=2)}\n\n")

            
            # ---------------------------------------------------------
            # Préparation des données pour le prompt
            # ---------------------------------------------------------
            
            # On extrait le contenu de la cible (string)
            target_content = payload.get(self.cible_id, "Données non disponibles")

            for config in grid_search:
                run_index = grid_search.index(config)
                # Appliquer la configuration spécifique (ex: température, top_p, etc.)
                self.temperature = config.get('temperature', self.temperature)
                # On peut ajouter d'autres paramètres ici selon les besoins
                self.language = config.get('language', self.language)

                if self.language == "en":
                    self.system_message: str = SYSTEM_MESSAGE_EN
                    self.validate_section_prompt_template: str = VALIDATE_SECTION_PROMPT_EN
                    self.tools_validator = TOOLS_VALIDATOR_EN
                else:
                    self.system_message: str = SYSTEM_MESSAGE_FR
                    self.validate_section_prompt_template: str = VALIDATE_SECTION_PROMPT_FR
                    self.tools_validator = TOOLS_VALIDATOR_FR
                
                self.num_references = config.get('num_references', 2)
                # num_references influence le nombre de similaires à utiliser
                similar_ids_selected = self.similar_ids[:self.num_references]
                payload_similar_truncated = {k: v for k, v in payload.items() if k in similar_ids_selected}
                # On crée un dictionnaire contenant UNIQUEMENT les similaires
                # (On exclut la clé self.cible_id)
                similar_content = {k: v for k, v in payload_similar_truncated.items()}


                policy_param = config['policy']
                policy_to_use = self.policies[policy_param]
                instruction = policy_to_use['checks'][i-1]['instruction']

            
                # ---------------------------------------------------------
                # 3. Appel au LLM Validator
                # ---------------------------------------------------------
                # Construction du prompt isolé pour cette étape
                step_prompt = self.validate_section_prompt_template.format(
                    policy_intro=policy_intro,
                    check_num=i,
                    total_checks=len(checks),
                    check_name=check_name,
                    instruction=instruction,
                    cible_id=self.cible_id,
                    target_content=target_content,
                    similar_content=json.dumps(similar_content, ensure_ascii=False, indent=2)
                )

                messages = [
                    {"role": "system", "content": self.system_message},
                    {"role": "user", "content": step_prompt}
                ]

                            # Log du prompt
                with open(run_config_paths[run_index]['prompt'], "a", encoding="utf-8") as f:
                    f.write(f"--- Check {i}: {check_name} ---\n")
                    f.write(step_prompt + "\n\n")

                # ---------------------------------------------------------
                # Appel pour chaque modèle
                # ---------------------------------------------------------
                for model, api_key in models_keys.items():
                    # Mise à jour du client pour le modèle courant
                    self.client = wrap_openai(OpenAI(
                        api_key=api_key,
                        base_url="https://api.groq.com/openai/v1",
                    ))
                    self.model = model


                    # Appel API
                    # Note: On assume ici que tools_validator contient désormais tool_report_step_issues
                    resp = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=self.temperature,
                        tools=self.tools_validator, 
                        tool_choice={"type": "function", "function": {"name": "report_step_issues"}}, 
                    )

                    outputs_by_config[run_index][model]['tokens'] += resp.usage.total_tokens
                    choice = resp.choices[0]
                    msg = choice.message
                    tool_calls = getattr(msg, "tool_calls", None)

                    # ---------------------------------------------------------
                    # 4. Traitement de la réponse
                    # ---------------------------------------------------------
                    step_issues = []
                    if tool_calls:
                        for tc in tool_calls:
                            if tc.function.name == "report_step_issues":
                                try:
                                    args = json.loads(tc.function.arguments)
                                    step_issues = args.get("issues", [])
                                    # On ajoute les issues trouvées à la liste globale
                                    outputs_by_config[run_index][model]['issues'].extend(step_issues)
                                except json.JSONDecodeError:
                                    pass # Erreur de parsing, on ignore ou on log

                    # Log de la réponse
                    with open(run_config_paths[run_index][model]["response"], "a", encoding="utf-8") as f:
                        f.write(f"--- Check {i}: {check_name} ---\n")
                        f.write(f"Issues found: {json.dumps(step_issues, ensure_ascii=False, indent=2)}\n\n")

        # Fin de la boucle sur les checks

        # ==============================================================================
        # 5. STATISTIQUES DE PERTURBATIONS
        # ==============================================================================

        self.stats = self.perturbation_engine.get_stats()




        for run_index in range(len(grid_search)):

            # ==============================================================================
            # 6. RAPPORT DE COUVERTURE (Coverage)
            # ==============================================================================
            with open(run_config_paths[run_index]['coverage'], "w", encoding="utf-8") as f:
                f.write(f"Module: {module_id}\n")
                f.write(f"Total Unique Attributes Covered: {len(covered_attributes)}\n")
                f.write("="*80 + "\n\n")
                # Tri alphabétique pour la lisibilité
                for attr in sorted(covered_attributes):
                    f.write(f"{attr}\n")

            # ==============================================================================
            # 7. RAPPORT FINAL & ANALYSE DE PERFORMANCE
            # ==============================================================================

            for model, _ in models_keys.items():
            
                # 1. Calculer les métriques globales (sur toutes les étapes)
                confusion_analysis = self._compute_confusion_matrix(outputs_by_config[run_index][model]["issues"])
                
                with open(run_config_paths[run_index][model]["performance"], "a", encoding="utf-8") as f:
                    # En-tête statistiques
                    f.write("="*80 + "\n")
                    f.write("GLOBAL CONFUSION MATRIX ANALYSIS\n")
                    f.write("="*80 + "\n\n")
                    
                    cm = confusion_analysis["confusion_matrix"]
                    metrics = confusion_analysis["metrics"]

                    # UPDATE THE OUTPUT DICTIONARY (Add these lines)
                    outputs_by_config[run_index][model]['recalls'] = metrics['recall']
                    outputs_by_config[run_index][model]['precisions'] = metrics['precision']
                    
                    f.write(f"True Positives (TP):  {cm['TP']} (Perturbations detected)\n")
                    f.write(f"False Positives (FP): {cm['FP']} (Hallucinations?)\n")
                    f.write(f"False Negatives (FN): {cm['FN']} (Perturbations missed)\n")
                    f.write(f"\nPrecision: {metrics['precision']:.4f}\n")
                    f.write(f"Recall:    {metrics['recall']:.4f}\n")
                    f.write(f"Accuracy:  {metrics['accuracy']:.4f}\n\n")
                    f.write(f"Total tokens used: {outputs_by_config[run_index][model]['tokens']}\n")
                    f.write("="*80 + "\n\n")

                    # 2. Rapport Détaillé Path par Path
                    f.write("DETAILED PERTURBED PATHS WITH CONTEXT\n")
                    f.write("="*80 + "\n\n")

                    analysis = confusion_analysis["perturbed_analysis"]
                    found_paths_set = set(analysis['perturbed_paths_found'])

                    # On itère sur l'historique pour garder l'ordre chronologique des checks
                    for iter_num, paths in self.perturbed_memory.items():
                        
                        # Le bloc de texte perturbé qui a été envoyé à CETTE étape
                        iter_block = iteration_payloads.get(iter_num, "")
                        
                        # Récupère aussi les valeurs perturbées pour ce matching précis
                        paths_values = self.perturbed_memory_with_values.get(iter_num, {})
                        
                        for perturbed_path in paths:
                            detected_status = "✓ DETECTED" if perturbed_path in found_paths_set else "✗ MISSED"
                            
                            f.write(f"{detected_status} [Iter {iter_num}]: {perturbed_path}\n")
                            
                            # A. Valeur Perturbée (Celle vue par le LLM à ce moment précis)
                            f.write(f"  Target (PERTURBED):\n")
                            found_in_target = False
                            
                            # Récupère la valeur perturbée pour ce path
                            perturbed_value = paths_values.get(perturbed_path, "")
                            
                            # Matching précis: cherche "path: perturbed_value"
                            target_line = f"{perturbed_path}: {perturbed_value}"
                            for line in iter_block.splitlines():
                                if line.strip() == target_line.strip():
                                    f.write(f"    {line.strip()}\n")
                                    found_in_target = True
                                    break
                            
                            if not found_in_target:
                                f.write(f"    [Value not found in payload block]\n")

                            # B. Valeurs de Référence (Similaires)
                            # On va chercher dans les contributions globales (car elles ne changent pas)
                            f.write(f"  Similar Events (References):\n")
                            for sim_id in self.similar_ids:
                                sim_contrib = self.contributions.get(sim_id, "")
                                found_in_sim = False
                                for line in sim_contrib.splitlines():
                                    if perturbed_path in line:
                                        f.write(f"    ID={sim_id}: {line.strip()}\n")
                                        found_in_sim = True
                                        break
                            
                            f.write("\n")

        return outputs_by_config


# ====================================================
#
# Path provider LLM
#
# ====================================================
class LlmPathProvider:

    def __init__(self, modele: str = "openai/gpt-oss-20b", api_key:str="",base_url:str="", language: str = "fr") -> None:

        self.client = wrap_openai(OpenAI(
            api_key=api_key,
            base_url=base_url,
        ))

        self.model = modele
        self.language = language
        
        # Select language-specific template
        if self.language == "en":
            self.prompt_template = PROMPT_FORMAT_PATHS_TEMPLATE_EN
        else:
            self.prompt_template = PROMPT_FORMAT_PATHS_TEMPLATE_FR


    def provide_path(self,description: str, paths: List[str]) -> List[str]:
        """Pour un texte de description et une liste de paths possibles,
        retourne la liste des paths pertinents selon le LLM.
        """

        if not paths:
            return []

        paths_list_str = "\n".join(f"- {p}" for p in paths)

        prompt = self.prompt_template.format(
            description=description,
            paths_list=paths_list_str,
        )

        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0,
            tools=TOOLS_PROVIDER_EN if self.language == "en" else TOOLS_PROVIDER_FR,
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
    
