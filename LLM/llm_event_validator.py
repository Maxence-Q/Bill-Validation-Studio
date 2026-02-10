

# libs import
from __future__ import annotations
from datetime import datetime
import random
from typing import Any, Dict, Optional, List, Tuple
import os
import json, textwrap
import difflib
from openai import OpenAI
import openai
from openai.types.chat import ChatCompletionMessageParam
from langsmith.wrappers import wrap_openai

# files import
from LLM.tools import *
from LLM.tools_en import *
from utils.event_validator_helper import *
from tests.test_perturbation.perturbation_engine import PerturbationEngine
from artefacts.description_donnee import MODULES_RULES


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

        # ===============================================
        # Contributions Format:
        # Dict { eid : List[str] | str}
        #
        # str: "Attr_1: val_1\nAttr_2: val_2\n..."
        #
        # if module Prices, PriceGroups, RTS&F: List[str]
        # else: str
        # ===============================================
        self.contributions: dict[int,Any] = contributions

        # 
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

    def extract_spec_element_name(self, marker, target_element_string):
        """
        Helper pour extraire la valeur de PriceGroup.PriceGroupNameFr d'une string formatée.
        """
        start_index = target_element_string.find(marker)
        if start_index == -1:
            return None
        
        # On cherche la fin de la ligne (le saut de ligne suivant)
        end_index = target_element_string.find("\n", start_index)
        
        # Si c'est la dernière ligne, on prend jusqu'à la fin de la string
        if end_index == -1:
            return target_element_string[start_index + len(marker):].strip()

        return target_element_string[start_index + len(marker):end_index].strip()

    def _normalize_path(self, path: str) -> str:
        """
        Normalize a path by removing module prefix if present.
        E.g., "OwnerPOS.Name" -> "Name"
        """
        if "." in path:
            parts = path.split(".")
            # If there's a dot, return the last part (the actual attribute name)
            return parts[-1]
        return path
    
    def _paths_match(self, perturbed_path: str, detected_path: str) -> bool:
        """
        Check if two paths match, accounting for module prefixes.
        E.g., "Name" matches "OwnerPOS.Name"
        """
        normalized_perturbed = self._normalize_path(perturbed_path)
        normalized_detected = self._normalize_path(detected_path)
        return normalized_perturbed == normalized_detected
    
    def _format_similar_content_as_string(self, similar_content: Dict[int, str]) -> str:
        """
        Format similar_content dict as a clean newline-separated string,
        matching the format of target_content (from payload).
        
        Instead of JSON serialization, this creates a readable format:
        ID: <id1>
        <content_string_1>
        
        ID: <id2>
        <content_string_2>
        
        Args:
            similar_content: Dict with event IDs as keys and content strings as values
            
        Returns:
            Formatted string representation of similar events
        """
        if not similar_content:
            return ""
        
        formatted_parts = []
        for event_id, content in similar_content.items():
            formatted_parts.append(f"ID: {event_id}")
            formatted_parts.append(content)
            formatted_parts.append("")  # Empty line for separation
        
        return "\n".join(formatted_parts)

    def _format_csv_comparison(self, target_str: str, similar_str: str) -> str:
        """
        Transforme deux blocs de texte 'Key: Value' en un tableau CSV comparatif.
        Format: PATH | TARGET_VALUE | REFERENCE_VALUE
        """
        # 1. Parsing du Target (Source de vérité pour les clés)
        target_dict = {}
        # On garde l'ordre d'insertion (garanti en Python 3.7+)
        for line in target_str.splitlines():
            line = line.strip()
            
            # CORRECTION : On cherche juste ":", pas ": "
            if ":" in line:
                # On coupe seulement au premier ":" pour gérer les clés
                key, val = line.split(":", 1)
                
                # .strip() sur la valeur va transformer "" ou " " en ""
                target_dict[key.strip()] = val.strip()

        # 2. Parsing du Similar (Reference)
        similar_dict = {}
        if similar_str:
            for line in similar_str.splitlines():
                line = line.strip()
                # Même correction ici pour la robustesse
                if ":" in line:
                    key, val = line.split(":", 1)
                    similar_dict[key.strip()] = val.strip()
        
        # 3. Construction du tableau
        # Header
        lines = ["PATH | TARGET | REFERENCE"]
        lines.append("--- | --- | ---") 

        # On itère UNIQUEMENT sur les clés du Target
        for key, target_val in target_dict.items():
            # Récupération de la valeur similaire ou fallback
            similar_val = similar_dict.get(key, "<NO REFERENCE>")
            
            # Nettoyage pour CSV (remplacement des pipes)
            t_clean = target_val.replace("|", "/")
            s_clean = similar_val.replace("|", "/")
            
            # Si la valeur est vide (cas float_to_empty), on l'affiche explicitement
            # pour que le LLM "voit" le vide, sinon ça peut faire un trou dans le tableau
            # Optionnel : Tu peux laisser vide, le tableau aura juste "||" ce qui est OK.
            # Mais mettre un marqueur explicite comme <EMPTY> peut aider le LLM.
            # Pour l'instant, on laisse vide comme le format standard.
            
            lines.append(f"{key} | {t_clean} | {s_clean}")

        return "\n".join(lines)

    def _compress_comparison_table(self, comparison_table: str) -> str:
        """
        Supprime les préfixes répétitifs dans le tableau CSV pour économiser des tokens.
        """
        # Définition des structures par module
        module_structures = {
            "RightToSellAndFees": ["EventPointOfSale", "RightToSellFees[]", "POSPriceGroups"],
            "Prices": ["PriceGroup", "MainPrice", "Prices[]"],
            "PriceGroups": [] # Comme mentionné, peu d'intérêt ici
        }
        
        prefixes = module_structures.get(self.module_id, [])
        if not prefixes:
            return comparison_table

        lines = comparison_table.splitlines()
        if len(lines) < 3: # Header + Separator + Data
            return comparison_table

        compressed_lines = lines[:2] # Garder le header "PATH | TARGET | REFERENCE" et le "---"
        current_section = None

        for line in lines[2:]:
            parts = line.split(" | ", 2)
            if len(parts) < 3:
                compressed_lines.append(line)
                continue
                
            full_path, target_val, ref_val = parts
            matched_prefix = None
            
            # Vérifier si le chemin commence par un des préfixes connus
            for p in prefixes:
                if full_path.startswith(p + "."):
                    matched_prefix = p
                    break
            
            if matched_prefix:
                # Si on change de section (ex: de EventPointOfSale à RightToSellFees)
                if current_section != matched_prefix:
                    current_section = matched_prefix
                    compressed_lines.append(f"**{current_section}:** | | ")
                
                # On ne garde que la partie après le point
                short_path = full_path[len(matched_prefix)+1:]
                compressed_lines.append(f"{short_path} | {target_val} | {ref_val}")
            else:
                # Hors section définie (réinitialise la section courante)
                current_section = None
                compressed_lines.append(line)

        return "\n".join(compressed_lines)

    def _inject_rules_into_table(self, compressed_table: str, module_rules: Dict[str, str]) -> str:
        """
        Ajoute une colonne 'VALIDATION_RULE' au tableau CSV compressé.
        """
        lines = compressed_table.splitlines()
        if len(lines) < 2:
            return compressed_table

        new_lines = []
        
        # 1. Mise à jour du Header
        header = lines[0] + " | VALIDATION_RULE"
        separator = lines[1] + " | ---"
        new_lines.extend([header, separator])

        # 2. Parcours des lignes de données
        for line in lines[2:]:
            # On split avec le pipe
            parts = [p.strip() for p in line.split("|")]
            
            # Cas des lignes de section (ex: **EventPointOfSale:**)
            if "**" in parts[0]:
                new_lines.append(f"{line} | ")
                continue
                
            # Extraction du nom de l'attribut (clé)
            attr_name = parts[0]
            rule = module_rules.get(attr_name, "Strict comparison required unless specified otherwise.")
            
            # Reconstruction de la ligne avec la règle
            new_lines.append(f"{line} | {rule}")

        return "\n".join(new_lines)

    def _compute_confusion_matrix(self, llm_issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compute confusion matrix based on perturbed paths and LLM-detected issues.
        
        Args:
            llm_issues: List of issues detected by LLM (from format_issues)
            
        Returns:
            Dict containing:
            - confusion_matrix: TP, FP, TN, FN counts (with totals and unique)
            - perturbed_paths_analysis: which perturbed paths were found/missed
            - all_detected_paths: all paths mentioned in issues
        """
        # Flatten all perturbed paths across all iterations (as list, preserving duplicates)
        all_perturbed_paths = []
        for paths_list in self.perturbed_memory.values():
            all_perturbed_paths.extend(paths_list)
        
        # Extract paths from LLM issues (as list, preserving duplicates)
        detected_paths = []
        for issue in llm_issues:
            if isinstance(issue, dict) and "path" in issue:
                detected_paths.append(issue["path"])
        
        # Compute confusion matrix ELEMENT BY ELEMENT using loops
        # Track which perturbed paths have been matched
        perturbed_matched = [False] * len(all_perturbed_paths)
        detected_matched = [False] * len(detected_paths)
        
        # TP: Find perturbed paths that are detected
        true_positives_list = []
        for i, perturbed_path in enumerate(all_perturbed_paths):
            for j, detected_path in enumerate(detected_paths):
                if self._paths_match(perturbed_path, detected_path):
                    true_positives_list.append((i, j, perturbed_path, detected_path))
                    perturbed_matched[i] = True
                    detected_matched[j] = True
                    break  # Move to next perturbed path after finding a match
        
        # FN: Perturbed paths that were NOT detected
        false_negatives_list = []
        for i, perturbed_path in enumerate(all_perturbed_paths):
            if not perturbed_matched[i]:
                false_negatives_list.append(perturbed_path)
        
        # FP: Detected paths that were NOT matched to perturbed paths
        false_positives_list = []
        for j, detected_path in enumerate(detected_paths):
            if not detected_matched[j]:
                false_positives_list.append(detected_path)
        
        # TN: paths not perturbed and not detected (we don't track all possible paths, so TN = 0)
        true_negatives = 0
        
        confusion_matrix = {
            "TP": len(true_positives_list),
            "FP": len(false_positives_list),
            "FN": len(false_negatives_list),
            "TN": true_negatives
        }
        
        # Calculate metrics
        total_perturbed = len(all_perturbed_paths)
        detected_count = len(detected_paths)
        
        metrics = {
            "precision": len(true_positives_list) / detected_count if detected_count > 0 else 0,
            "recall": len(true_positives_list) / total_perturbed if total_perturbed > 0 else 0,
            "accuracy": len(true_positives_list) / (len(true_positives_list) + len(false_positives_list) + len(false_negatives_list)) if (len(true_positives_list) + len(false_positives_list) + len(false_negatives_list)) > 0 else 0,
        }
        print("metrics[recall]: ", metrics["recall"],"\n")
        
        # For perturbed paths analysis, get unique paths to avoid duplicates in reporting
        unique_true_positives = list(set(path for _, _, path, _ in true_positives_list))
        unique_false_negatives = list(set(false_negatives_list))
        unique_false_positives = list(set(false_positives_list))
        unique_detected = list(set(detected_paths))
        
        perturbed_analysis = {
            "perturbed_paths_found": unique_true_positives,
            "perturbed_paths_missed": unique_false_negatives,
            "false_positive_paths": unique_false_positives,
        }
        
        return {
            "confusion_matrix": confusion_matrix,
            "metrics": metrics,
            "perturbed_analysis": perturbed_analysis,
            "all_perturbed_paths": list(set(all_perturbed_paths)),  # Unique only for reporting
            "all_detected_paths": unique_detected,
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
            similar_content_dict = {k: v for k, v in payload.items() if k != self.cible_id}
            similar_content = self._format_similar_content_as_string(similar_content_dict)
            
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
                similar_content=similar_content
            )

            messages: list[ChatCompletionMessageParam] = [
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

            total_tokens += resp.usage.total_tokens if resp.usage else 0
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
            
            f.write(f"True Positives (TP):  {cm['TP']} unique paths, {cm.get('TP_total', cm['TP'])} total occurrences (Perturbations detected)\n")
            f.write(f"False Positives (FP): {cm['FP']} unique paths, {cm.get('FP_total', cm['FP'])} total occurrences (Hallucinations?)\n")
            f.write(f"False Negatives (FN): {cm['FN']} unique paths, {cm.get('FN_total', cm['FN'])} total occurrences (Perturbations missed)\n")
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

            messages: list[ChatCompletionMessageParam] = [
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

            total_tokens += resp.usage.total_tokens if resp.usage else 0
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
            similar_content_dict = {k: v for k, v in payload.items() if k != self.cible_id}
            similar_content = self._format_similar_content_as_string(similar_content_dict)
            
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
                similar_content=similar_content
            )

            messages: list[ChatCompletionMessageParam] = [
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

                output[model]['tokens'] += resp.usage.total_tokens if resp.usage else 0
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
                
                f.write(f"True Positives (TP):  {cm['TP']} unique paths, {cm.get('TP_total', cm['TP'])} total occurrences (Perturbations detected)\n")
                f.write(f"False Positives (FP): {cm['FP']} unique paths, {cm.get('FP_total', cm['FP'])} total occurrences (Hallucinations?)\n")
                f.write(f"False Negatives (FN): {cm['FN']} unique paths, {cm.get('FN_total', cm['FN'])} total occurrences (Perturbations missed)\n")
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
            # if num_attributes >=7, on perturbe maximalement 5 attributs,
            # si nombre impair, on arrondit vers le bas
            max_attrs = max(1, 5) if num_attributes >=7 else max(1, num_attributes)

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
                similar_content_dict = {k: v for k, v in payload_similar_truncated.items()}
                similar_content = self._format_similar_content_as_string(similar_content=similar_content_dict)

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
                    similar_content=similar_content
                )

                messages: list[ChatCompletionMessageParam] = [
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

                    outputs_by_config[run_index][model]['tokens'] += resp.usage.total_tokens if resp.usage else 0
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
    

    def validate_section_spec_with_multiple_configs_and_models(self, models_keys: Dict[str,str], grid_search_spec: List[Dict[str, Any]]) -> Dict[int, Dict[str, Dict[str, Any]]]:
        """
            Exécute la validation séquentielle des listes de massive data.
            Pour chaque élément de la liste :
            1. À venir
            2. À venir 
            3. Interroge le LLM pour valider cet élément précis.
            4. Agrège les anomalies.
        """

        module_id = self.module_id

        # Pour chaque run_config, on créer un sous-dossier /event_id_datetime_runindex"
        # qu'on doit stocker
        run_config_paths = {}

        for run_index in range(len(grid_search_spec)):
            main_log_path = os.path.join(self.log_path, f"event{self.cible_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_run{run_index}")
            os.makedirs(main_log_path, exist_ok=True)
            run_config_paths[run_index] = {"main_log_path": main_log_path}


            config_log_path = os.path.join(main_log_path, "run_config.json")
            with open(config_log_path, "w", encoding="utf-8") as f:
                json.dump(grid_search_spec[run_index], f, ensure_ascii=False, indent=2)

            # Préparation des logs
            for model, _ in models_keys.items():
                run_config_paths[run_index][model] = {}
                model_log_path = main_log_path + f"/{model.replace('/', '_')}"
                response_log_path = os.path.join( model_log_path,f"responses.txt")
                performance_log_path = os.path.join(model_log_path, f"performance.txt")
                reasoning_log_path = os.path.join(model_log_path, f"reasoning.txt")

                for path in [response_log_path, performance_log_path, reasoning_log_path]:
                    os.makedirs(os.path.dirname(path), exist_ok=True)

                run_config_paths[run_index][model]['response'] = response_log_path
                run_config_paths[run_index][model]['performance'] = performance_log_path
                run_config_paths[run_index][model]['reasoning'] = reasoning_log_path

            prompt_log_path = os.path.join(main_log_path, f"prompts.txt")
            perturbations_log_path = os.path.join(main_log_path, f"perturbations.txt")
            for path in [prompt_log_path, perturbations_log_path]:
                    os.makedirs(os.path.dirname(path), exist_ok=True)
            run_config_paths[run_index]['prompt'] = prompt_log_path
            run_config_paths[run_index]['perturbations'] = perturbations_log_path

        # Sortie de la fonction
        outputs_by_config: Dict[int, Dict[str, Any]] = {idx: {model: {} for model in models_keys.keys()} for idx in range(len(grid_search_spec))}
        for idx in range(len(grid_search_spec)):
            for model in models_keys.keys():
                outputs_by_config[idx][model]['issues'] = []
                outputs_by_config[idx][model]['tokens'] = 0
                outputs_by_config[idx][model]['prompt_tokens'] = 0
                outputs_by_config[idx][model]['completion_tokens'] = 0
                outputs_by_config[idx][model]['recalls'] = 0
                outputs_by_config[idx][model]['precisions'] = 0

        # Pour stocker le bloc de texte perturbé spécifique à chaque itération
        # Key: iteration number, Value: The perturbed text block sent to LLM
        iteration_payloads: Dict[int, str] = {}

        # Reset memory for this run
        self.perturbed_memory = {}
        self.perturbed_memory_with_values = {}
        
        # Récupération de l'introduction de la policy
        policy_intro = self.policies["strict"].get('policy_intro', "")

        # ---------------------------------------------------------
        # 
        # 
        # ---------------------------------------------------------

        marker = ""
        element_name = ""
        if self.module_id == "Prices":
            marker = "PriceGroup.PriceGroupNameFr: "
            element_name = "PriceGroup"
        elif self.module_id == "PriceGroups":
            marker = "Name: "
            element_name = "PriceGroupModel"
        elif self.module_id == "RightToSellAndFees":
            marker = "RO_PointOfSaleName: "
            element_name = "RightToSellAndFeeModel"
        prepared_prompts = {}
        target_list = self.contributions.get(self.cible_id, [])
        for index, target_element_str in enumerate(target_list):
            found_similar_str = ""
            strategy_used = ""
            target_name = self.extract_spec_element_name(marker, target_element_str)
            # Si on a réussi à extraire un nom, on cherche une correspondance
            if target_name:
                # On parcourt les événements similaires dans l'ordre (top_k 1, 2, 3...)
                for sim_id in self.similar_ids:
                    similar_list = self.contributions.get(sim_id, [])
                    # On cherche un élément avec le même nom dans cet événement similaire
                    for sim_element_str in similar_list:
                        if self.extract_spec_element_name(marker, sim_element_str) == target_name:
                            found_similar_str = sim_element_str
                            break # Trouvé dans cet event, on arrête de chercher dans la liste
                    
                    if found_similar_str:
                        strategy_used = "exact_match"
                        break # Trouvé un match global, on arrête de chercher dans les autres events
                # fallback si pas trouvé, on donne un similar aléatoire dans le premier event similaire
                # si possible le plus similaire lexicalement
            if not found_similar_str:
                first_sim_id = self.similar_ids[0]
                similar_list = self.contributions.get(first_sim_id, [])
                if similar_list and target_name:
                    best_match = None
                    best_score = 0.0
                    for sim_element_str in similar_list:
                        sim_name = self.extract_spec_element_name(marker, sim_element_str)
                        if sim_name:
                            # Calcul du score de similarité (entre 0.0 et 1.0)
                            # On met en minuscule pour éviter les soucis de casse
                            score = difflib.SequenceMatcher(None, target_name.lower(), sim_name.lower()).ratio()
                            
                            if score > best_score:
                                best_score = score
                                best_match = sim_element_str
                    
                    # On définit un seuil minimal (ex: 0.4) pour éviter de lier "VIP" à "Enfant" 
                    # juste parce que c'est le seul choix. 
                    # Si tu veux forcer un choix quoi qu'il arrive, mets le seuil à 0.0.
                    threshold = 0.0
                    
                    if best_match and best_score >= threshold:
                        strategy_used = f"lexical_similarity score={best_score:.2f}"
                        found_similar_str = best_match
            # Construction de l'objet de sortie
            prepared_prompts[index] = {
                "target": target_element_str,
                "similar": found_similar_str,
                "strategy": strategy_used,
                "sim_id": sim_id if found_similar_str else first_sim_id
            }

        total_elements = len(self.contributions[self.cible_id])
        i=0
        # ---------------------------------------------------------
        # On itère sur chaque élément de la contribution (liste)
        # ---------------------------------------------------------
        for index,target_element in enumerate(target_list):
            i += 1
            # ---------------------------------------------------------
            # Injection de Perturbations
            # ---------------------------------------------------------
            
            block_lines = [line.strip() for line in target_element.splitlines() if line.strip()]
            num_attributes = len(block_lines)
            min_attrs = max(1, min(num_attributes, 1))
            max_attrs = max(1,num_attributes//8)  # On perturbe jusqu'à 12.5% des attributs
            # Injection
            original, perturbed, block = self.perturbation_engine.inject_perturbation(
                block=target_element,
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
            target_element = block
            self.final_perturbed_payload[self.cible_id] = block # Keep latest for debug

            # Log des perturbations
            for run_index in range(len(grid_search_spec)):
                perturbations_log_path = run_config_paths[run_index]['perturbations']
                with open(perturbations_log_path, "a", encoding="utf-8") as f:
                    f.write(f"--- Element {i}/{total_elements} ---\n")
                    f.write(f"Original Block:\n{json.dumps(original, ensure_ascii=False, indent=2)}\n")
                    f.write(f"Perturbed Block:\n{json.dumps(perturbed, ensure_ascii=False, indent=2)}\n\n")


            # --- NOUVEAU : Création du tableau comparatif ---
            current_target_str = target_element
            current_similar_str = prepared_prompts[index]['similar']
            
            # On génère le bloc CSV
            comparison_table = self._format_csv_comparison(
                target_str=current_target_str,
                similar_str=current_similar_str
            )
            comparison_table = self._compress_comparison_table(comparison_table)

            module_rules = MODULES_RULES[module_id]
            comparison_table = self._inject_rules_into_table(comparison_table, module_rules)
            
            # ---------------------------------------------------------
            # Préparation des données pour le prompt
            # ---------------------------------------------------------
            for config in grid_search_spec:
                run_index = grid_search_spec.index(config)
                self.temperature = config.get('temperature', self.temperature)

                # ---------------------------------------------------------
                # Appel au LLM Validator
                # ---------------------------------------------------------
                # Construction du prompt isolé pour cette étape
                step_prompt = self.validate_section_spec_prompt_template.format(
                    policy_intro=policy_intro,
                    element_name=element_name,
                    cible_id=self.cible_id,
                    similar_id=prepared_prompts[index]['sim_id'],
                    strategy_used=prepared_prompts[index]['strategy'],
                    comparison_data=comparison_table
                )

                messages: list[ChatCompletionMessageParam] = [
                    {"role": "system", "content": self.system_message},
                    {"role": "user", "content": step_prompt}
                ]

                # Log du prompt
                with open(prompt_log_path, "a", encoding="utf-8") as f:
                    f.write(f"--- Élément {i}/{total_elements} ---\n")
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

                    try:
                        resp = self.client.chat.completions.create(
                            model=self.model,
                            messages=messages,
                            temperature=self.temperature,
                            tools=self.tools_validator, 
                            tool_choice={"type": "function", "function": {"name": "report_step_issues"}},
                            reasoning_effort="medium"
                        )
                    except openai.BadRequestError as e:
                        # 1. Extraction sécurisée des données de l'erreur
                        error_data = {}
                        try:
                            # Tente d'accéder au dictionnaire body directement
                            if isinstance(e.body, dict):
                                error_data = e.body
                            else:
                                # Parfois l'erreur est dans e.message ou e.body sous forme de string
                                error_data = json.loads(e.response.text).get('error', {})
                        except Exception:
                            # Fallback ultime : si on ne peut rien parser, on log et on relance
                            print(f"❌ Impossible de parser le corps de la BadRequestError : {e}")
                            raise e

                        # 2. Vérification du code d'erreur spécifique à Groq/OpenAI
                        if error_data.get('code') == 'tool_use_failed':
                            failed_generation = error_data.get('failed_generation')
                            
                            if not failed_generation:
                                raise e

                            print(f"⚠️ Erreur de parsing détectée. Tentative de correction...")

                            # --- Logique de réparation ---
                            # Note : On nettoie failed_generation car c'est parfois une string JSON 
                            # contenant l'appel de fonction complet (name + arguments)
                            repair_target = failed_generation
                            try:
                                temp_data = json.loads(failed_generation)
                                if "arguments" in temp_data:
                                    # Si failed_generation est l'objet complet, on n'extrait que les arguments
                                    # pour faciliter le travail du second LLM
                                    repair_target = json.dumps(temp_data["arguments"])
                            except:
                                pass # On garde la string brute si le JSON est trop cassé

                            correction_prompt: list[ChatCompletionMessageParam] = [
                                {"role": "system", "content": "You are a JSON repair expert. Fix syntax errors. Output ONLY valid JSON."},
                                {"role": "user", "content": f"Fix this JSON issues list: {repair_target}"}
                            ]
                            
                            correction_resp = self.client.chat.completions.create(
                                model="openai/gpt-oss-120b", # Ou un modèle plus puissant si nécessaire
                                messages=correction_prompt,
                                temperature=0,
                            )
                            
                            fixed_content = correction_resp.choices[0].message.content
                            
                            # On tente de reconstruire une réponse simulée ou de parser manuellement
                            try:
                                # On nettoie d'éventuels backticks markdown
                                clean_json = fixed_content.strip().replace("```json", "").replace("```", "") # type: ignore
                                arguments = json.loads(clean_json)
                                
                                # Ici, on simule l'objet "resp" pour que la suite de ton code fonctionne
                                # Note: On crée un objet anonyme ou une classe simple pour mimer la structure
                                class MockResponse:
                                    def __init__(self, args, original_usage):
                                        # On récupère l'usage de la réponse de correction pour ne pas fausser les stats
                                        self.usage = original_usage 
                                        self.choices = [type('obj', (object,), {
                                            'message': type('obj', (object,), {
                                                'tool_calls': [type('obj', (object,), {
                                                    'function': type('obj', (object,), {
                                                        'name': 'report_step_issues',
                                                        'arguments': json.dumps(args)
                                                    })
                                                })]
                                            })
                                        })]
                                
                                resp = MockResponse(arguments, original_usage=correction_resp.usage)
                                print("✅ JSON corrigé avec succès.")
                                
                            except Exception as repair_error:
                                print(f"❌ Échec de la correction : {repair_error}")
                                raise e # Si on n'arrive pas à réparer, on relance l'erreur d'origine
                        else:
                            raise e # Relancer si c'est une autre erreur 400
                    if resp.usage:
                        outputs_by_config[run_index][model]['tokens'] += resp.usage.total_tokens
                        input_tokens = resp.usage.prompt_tokens
                        output_tokens = resp.usage.completion_tokens
                        reasoning_tokens = resp.usage.completion_tokens_details.reasoning_tokens if resp.usage.completion_tokens_details else 0
                        outputs_by_config[run_index][model]['prompt_tokens'] += input_tokens
                        outputs_by_config[run_index][model]['completion_tokens'] += output_tokens
                    choice = resp.choices[0]
                    msg = choice.message # type: ignore
                    tool_calls = getattr(msg, "tool_calls", None)

                    reasoning_text = ""
                    if hasattr(msg, "model_extra") and msg.model_extra:
                        reasoning_text = msg.model_extra.get("reasoning", "")

                    with open(prompt_log_path, "a", encoding="utf-8") as f:
                        f.write(f"  - Input (Prompt): {input_tokens}\n\n")
                    with open(run_config_paths[run_index][model]['reasoning'], "a", encoding="utf-8") as f:
                        f.write(f"--- Element {i}/{total_elements} ---\n")
                        f.write(reasoning_text + "\n\n")

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
                        f.write(f"--- Element {i}/{total_elements} ---\n")
                        f.write(f"  - Output's tokens': {output_tokens-reasoning_tokens}\n")
                        f.write(f"  - Reasoning tokens: {reasoning_tokens}\n")
                        f.write(f"Issues found: {json.dumps(step_issues, ensure_ascii=False, indent=2)}\n\n")

        # Fin de la boucle sur les éléments
        # ==============================================================================
        # 5. STATISTIQUES DE PERTURBATIONS
        # ==============================================================================

        self.stats = self.perturbation_engine.get_stats()

        for run_index in range(len(grid_search_spec)):

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
                    f.write(f"  - Input (Prompt): {outputs_by_config[run_index][model]['prompt_tokens']}\n")
                    f.write(f"  - Output (Completion): {outputs_by_config[run_index][model]['completion_tokens']}\n")
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

                            # B. Valeur de Référence (Similaire)
                            f.write(f"  Reference (SIMILAR):\n")
                            
                            # Note : iter_num est 1-based (car i += 1 au début de la boucle de validation),
                            # alors que prepared_prompts est 0-based (construit via enumerate).
                            prompt_idx = iter_num - 1
                            prompt_data = prepared_prompts.get(prompt_idx, {})
                            similar_block_str = prompt_data.get("similar", "")
                            
                            if not similar_block_str:
                                f.write("    [No similar reference found for this element]\n")
                            else:
                                found_in_ref = False
                                # On construit le préfixe exact pour éviter les faux positifs (ex: "Price" vs "PriceGroup")
                                target_prefix = f"{perturbed_path}:"
                                
                                # On cherche la ligne dans le bloc similaire
                                for line in similar_block_str.splitlines():
                                    if line.strip().startswith(target_prefix):
                                        f.write(f"    {line.strip()}\n")
                                        found_in_ref = True
                                        break
                                
                                if not found_in_ref:
                                    f.write(f"    [Path '{perturbed_path}' not found in reference block]\n")
                            
                            f.write("-" * 40 + "\n") # Séparateur visuel entre les paths

                        f.write("\n"+"="*40+"\n") # Séparateur visuel entre les itérations
                            

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
    
