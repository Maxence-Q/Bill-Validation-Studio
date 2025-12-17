import os
import re
import json
import glob
from collections import defaultdict
from typing import Dict, List, Any

def parse_config(config_path: str) -> Dict[str, str]:
    """
    Parses the config.txt file to get the module -> model mapping.
    Expected format is a JSON-like structure starting from the first '{'.
    """
    try:
        with open(config_path, 'r') as f:
            content = f.read()
            # Find the start of the JSON object
            match = re.search(r'(\{.*)', content, re.DOTALL)
            if match:
                json_str = match.group(1)
                config = json.loads(json_str)
                # Extract just the model name (first element of the list) for each module
                mapping = {}
                for module, values in config.items():
                    if isinstance(values, list) and len(values) > 0:
                        mapping[module] = values[0]
                return mapping
    except Exception as e:
        print(f"Error parsing config {config_path}: {e}")
    return {}

def parse_performance(perf_path: str) -> Dict[str, float]:
    """
    Parses the performance.txt file to extract metrics.
    """
    metrics = {}
    try:
        with open(perf_path, 'r') as f:
            content = f.read()
            
            # Regex patterns for integer values
            tp_match = re.search(r'True Positives \(TP\):\s*(\d+)', content)
            fp_match = re.search(r'False Positives \(FP\):\s*(\d+)', content)
            fn_match = re.search(r'False Negatives \(FN\):\s*(\d+)', content)
            tn_match = re.search(r'True Negatives \(TN\):\s*(\d+)', content)

            # Regex patterns for float values
            prec_match = re.search(r'Precision:\s*([\d\.]+)', content)
            recall_match = re.search(r'Recall:\s*([\d\.]+)', content)
            acc_match = re.search(r'Accuracy:\s*([\d\.]+)', content)

            if tp_match: metrics['TP'] = int(tp_match.group(1))
            if fp_match: metrics['FP'] = int(fp_match.group(1))
            if fn_match: metrics['FN'] = int(fn_match.group(1))
            if tn_match: metrics['TN'] = int(tn_match.group(1))
            
            if prec_match: metrics['Precision'] = float(prec_match.group(1))
            if recall_match: metrics['Recall'] = float(recall_match.group(1))
            if acc_match: metrics['Accuracy'] = float(acc_match.group(1))
            
    except Exception as e:
        print(f"Error parsing performance {perf_path}: {e}")
        return {}
    return metrics

def aggregate_results(logs_root: str):
    """
    Iterates over event folders and aggregates metrics.
    """
    module_stats = defaultdict(list)
    model_stats = defaultdict(list)
    
    # Path to logs directory relative to project root (assuming script is run from project root)
    # If run from tests/test_perturbation, we might need to adjust, but let's assume project root execution
    # or handle absolute paths if needed. 
    # Based on user instruction "project_root/logs/module_mangaer_test"
    
    if not os.path.exists(logs_root):
        print(f"Logs directory not found: {logs_root}")
        return

    event_folders = [f for f in os.listdir(logs_root) if re.match(r'event\d+_\d{8}_\d{6}', f)]
    
    print(f"Found {len(event_folders)} event folders in {logs_root}")

    for event_folder in event_folders:
        event_path = os.path.join(logs_root, event_folder)
        config_path = os.path.join(event_path, "config.txt")
        
        if not os.path.exists(config_path):
            continue
            
        module_model_map = parse_config(config_path)
        
        modules = ["Event", "EventDates", "FeeDefinitions", "OwnerPOS"]
        
        for module in modules:
            perf_path = os.path.join(event_path, module, "performance.txt")
            
            if os.path.exists(perf_path):
                metrics = parse_performance(perf_path)
                if metrics:
                    # Store for Module Aggregation
                    module_stats[module].append(metrics)
                    
                    # Store for Model Aggregation
                    model_name = module_model_map.get(module)
                    if model_name:
                        model_stats[model_name].append(metrics)

    return module_stats, model_stats

def print_summary(stats: Dict[str, List[Dict[str, float]]], title: str):
    print(f"\n{'='*20} {title} {'='*20}")
    for key, metrics_list in stats.items():
        if not metrics_list:
            continue
            
        count = len(metrics_list)
        avg_precision = sum(m.get('Precision', 0) for m in metrics_list) / count
        avg_recall = sum(m.get('Recall', 0) for m in metrics_list) / count
        avg_accuracy = sum(m.get('Accuracy', 0) for m in metrics_list) / count
        
        print(f"\n{key} (Samples: {count}):")
        print(f"  Avg Precision: {avg_precision:.4f}")
        print(f"  Avg Recall:    {avg_recall:.4f}")
        print(f"  Avg Accuracy:  {avg_accuracy:.4f}")

if __name__ == "__main__":
    # Determine the project root assuming this script is in tests/test_perturbation/
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
    logs_dir = os.path.join(project_root, "logs", "module_manager_test")
    
    print(f"Scanning logs in: {logs_dir}")
    
    mod_stats, model_stats = aggregate_results(logs_dir)
    
    print_summary(mod_stats, "MODULE PERFORMANCE")
    print_summary(model_stats, "MODEL PERFORMANCE")
