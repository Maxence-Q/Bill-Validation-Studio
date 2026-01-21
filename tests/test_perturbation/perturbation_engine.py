import random
import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Callable
import uuid
from collections import Counter


class PerturbationEngine:
    """
    A class to inject perturbations into structured data for testing robustness.
    Handles various data types: str, int, bool, date, UUID, null, empty strings.

    Strings: empty string, character substitution, truncation, reversal
    UUIDs: random UUID, null, empty, or mutate hex digits
    Dates: null, empty, random date, shift by ±365 days
    Integers: null, empty, random int, increment/decrement, zero
    Booleans: flip, null, empty
    Null values: empty, zero, false, or keep null
    Empty strings: keep empty, null, or random string
    """

    def __init__(self, seed: Optional[int] = None):
        """Initialize the perturbation engine with optional seed for reproducibility."""
        if seed is not None:
            random.seed(seed)

        # Initialisation du compteur de statistiques
        self.stats = Counter()

    def get_stats(self) -> Dict[str, int]:
        """
        Returns the statistics of applied perturbations.
        Example: {'null_to_empty_string': 5, 'integer_to_zero': 2}
        """
        return dict(self.stats)
    

    def inject_perturbation(self, block: str, min_attributes:int=1,max_attributes: int = 5) -> Tuple[Dict[int, str], Dict[int, str], str]:
        """
        Main function to inject perturbations into a block of text.
        
        Args:
            block: String containing lines in format "path: value"
            min_attributes: Minimum number of attributes to modify
            max_attributes: Maximum number of attributes to modify
            
        Returns:
            Tuple containing:
            - original_modified: Dict[index, original_line] of lines that were modified
            - perturbed_modified: Dict[index, perturbed_line] of lines after modification
            - perturbed_block: String with all perturbations applied (joined with newlines)
        """
        # Parse the block into lines
        lines = []
        for line in block.splitlines():
            line = line.strip()
            if not line:
                continue
            path, sep, value = line.partition(": ")
            if not sep:
                continue
            lines.append((path, value))

        # Choose random number of attributes to modify
        # Ensure min_attributes <= max_attributes and both are valid
        actual_max = min(max_attributes, len(lines))
        actual_min = min(min_attributes, actual_max)
        
        if len(lines) == 0:
            return {}, {}, ""
        
        if actual_min == actual_max:
            num_to_modify = actual_min
        else:
            num_to_modify = random.randint(actual_min, actual_max)
        indices_to_modify = random.sample(range(len(lines)), num_to_modify)

        # Track original and perturbed modified lines
        original_modified = {}
        perturbed_modified = {}

        # Apply perturbations
        perturbed_lines = []
        for idx, (path, value) in enumerate(lines):
            if idx in indices_to_modify:
                # Check if value contains '=' symbols (key=value format)
                if "=" in value:
                    perturbed_value = self._perturb_key_value_pairs(value)
                else:
                    perturbed_value = self._perturb_value(value, path)
                original_line = f"{path}: {value}"
                perturbed_line = f"{path}: {perturbed_value}"
                original_modified[idx] = original_line
                perturbed_modified[idx] = perturbed_line
                perturbed_lines.append(perturbed_line)
            else:
                perturbed_lines.append(f"{path}: {value}")

        perturbed_block = "\n".join(perturbed_lines)
        return original_modified, perturbed_modified, perturbed_block

    def _perturb_value(self, value: str, path: str) -> str:
        """
        Route to appropriate perturbation method based on value type.

        Args:
            value: The value to perturb
            path: The path/key (used to detect date fields)

        Returns:
            Perturbed value
        """
        # Detect value type and apply appropriate perturbation
        if value.lower() == "null":
            return self._perturb_null()
        elif value == "":
            return self._perturb_empty_string()
        elif self._is_uuid(value):
            return self._perturb_uuid(value)
        elif self._is_date(value):
            return self._perturb_date(value)
        elif self._is_boolean(value):
            return self._perturb_boolean(value)
        elif self._is_integer(value):
            return self._perturb_integer(value)
        else:  # Treat as string
            return self._perturb_string(value)

    def _perturb_key_value_pairs(self, value: str) -> str:
        """
        Perturb a value containing key=value pairs (separated by ', ').
        Only modifies the values after '=' while keeping keys intact.
        Skips SectionID pairs and applies type-specific perturbations.
        Format: "SectionID=12345: key1=value1, key2=value2, ..."
        
        Args:
            value: String containing key=value pairs
            
        Returns:
            String with some values perturbed
        """
        # First, separate SectionID part from the rest
        # Format: "SectionID=80331: Price=0.0, FakePriceOnTicket=False, ..."
        if ": " in value:
            section_part, attributes_part = value.split(": ", 1)
        else:
            # No SectionID format, treat entire value as attributes
            section_part = None
            attributes_part = value
        
        # Split attributes by ', ' to get individual key=value pairs
        pairs = attributes_part.split(", ")
        
        # Collect all modifiable pair indices
        modifiable_indices = list(range(len(pairs)))
        
        if not modifiable_indices:
            return value
        
        # Randomly select which pairs to modify
        # If only 1 pair, select it; otherwise select between 1 and len
        if len(modifiable_indices) == 1:
            num_pairs_to_modify = 1
        else:
            num_pairs_to_modify = random.randint(1, len(modifiable_indices))
        indices_to_modify = random.sample(modifiable_indices, min(num_pairs_to_modify, len(modifiable_indices)))

        perturbed_pairs = []
        for idx, pair in enumerate(pairs):
            if idx in indices_to_modify:
                # Split pair by '=' to separate key and value
                if "=" in pair:
                    key, sep, val = pair.partition("=")
                    # Type-detect and perturb the value
                    perturbed_val = self._perturb_value(val, key)
                    perturbed_pairs.append(f"{key}={perturbed_val}")
                else:
                    perturbed_pairs.append(pair)
            else:
                perturbed_pairs.append(pair)

        # Reconstruct the value
        perturbed_attributes = ", ".join(perturbed_pairs)
        if section_part is not None:
            return f"{section_part}: {perturbed_attributes}"
        else:
            return perturbed_attributes
        
    def _apply_strategy(self, strategies: List[Tuple[str, Callable]], value=None) -> str:
        """Helper to pick a strategy, update stats, and execute it."""
        name, func = random.choice(strategies)
        self.stats[name] += 1
        if value is not None:
            return func(value)
        return func()

    # --- Type Checkers (unchanged) ---

    def _is_uuid(self, value: str) -> bool:
        """Check if value is a UUID."""
        uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        return bool(re.match(uuid_pattern, value, re.IGNORECASE))

    def _is_date(self, value: str) -> bool:
        """Check if value is an ISO 8601 date string."""
        date_patterns = [
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$",  # 2011-12-05T10:44:33.54Z
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$",              # 2036-02-18T19:00:00
            r"^\d{4}-\d{2}-\d{2}$",                                 # 2036-02-18
        ]
        return any(bool(re.match(pattern, value)) for pattern in date_patterns)

    def _is_boolean(self, value: str) -> bool:
        """Check if value is a boolean."""
        return value.lower() in ["true", "false"]

    def _is_integer(self, value: str) -> bool:
        """Check if value is an integer."""
        try:
            int(value)
            return "." not in value  # Avoid treating floats as integers
        except ValueError:
            return False

    # --- Perturbation Methods with Stats Tracking ---

    def _perturb_string(self, value: str) -> str:
        strategies = [
            ("string_to_empty", lambda v: ""),
            ("string_char_substitution", lambda v: self._substitute_characters(v)),
            ("string_truncation", lambda v: v[:len(v)//2] if len(v) > 1 else ""),
            ("string_reversal", lambda v: v[::-1] if len(v) > 1 else v),
        ]
        return self._apply_strategy(strategies, value)

    def _substitute_characters(self, value: str) -> str:
        if len(value) == 0:
            return value
        value_list = list(value)
        num_substitutions = random.randint(1, max(1, len(value) // 2))
        indices = random.sample(range(len(value_list)), num_substitutions)
        for idx in indices:
            value_list[idx] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
        return "".join(value_list)

    def _perturb_uuid(self, value: str) -> str:
        strategies = [
            ("uuid_random", lambda v: str(uuid.uuid4())),
            ("uuid_to_empty", lambda v: ""),
            ("uuid_to_null", lambda v: "null"),
            ("uuid_mutation", lambda v: self._mutate_uuid(v)),
        ]
        return self._apply_strategy(strategies, value)

    def _mutate_uuid(self, value: str) -> str:
        value_list = list(value)
        hex_indices = [i for i, c in enumerate(value_list) if c != "-"]
        if hex_indices:
            num_mutations = random.randint(1, max(1, len(hex_indices) // 3))
            mutation_indices = random.sample(hex_indices, num_mutations)
            for idx in mutation_indices:
                value_list[idx] = random.choice("0123456789abcdef")
        return "".join(value_list)

    def _perturb_date(self, value: str) -> str:
        strategies = [
            ("date_to_empty", lambda v: ""),
            ("date_to_null", lambda v: "null"),
            ("date_random", lambda v: self._generate_random_date()),
            ("date_shift", lambda v: self._shift_date(v)),
        ]
        return self._apply_strategy(strategies, value)

    def _generate_random_date(self) -> str:
        start_year = 1970
        end_year = 2050
        random_year = random.randint(start_year, end_year)
        random_month = random.randint(1, 12)
        random_day = random.randint(1, 28)
        random_hour = random.randint(0, 23)
        random_minute = random.randint(0, 59)
        random_second = random.randint(0, 59)
        return f"{random_year:04d}-{random_month:02d}-{random_day:02d}T{random_hour:02d}:{random_minute:02d}:{random_second:02d}"

    def _shift_date(self, value: str) -> str:
        try:
            date_obj = None
            for fmt in ["%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]:
                try:
                    date_obj = datetime.strptime(value.rstrip("Z"), fmt.replace("Z", ""))
                    break
                except ValueError:
                    continue

            if date_obj:
                shift_days = random.randint(-365, 365)
                shifted_date = date_obj + timedelta(days=shift_days)
                if "Z" in value:
                    return shifted_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                elif "." in value:
                    return shifted_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
                else:
                    return shifted_date.strftime("%Y-%m-%dT%H:%M:%S")
            else:
                return ""
        except Exception:
            return ""

    def _perturb_integer(self, value: str) -> str:
        try:
            int_value = int(value)
            strategies = [
                ("integer_to_empty", lambda v: ""),
                ("integer_to_null", lambda v: "null"),
                ("integer_random", lambda v: str(random.choice([i for i in range(-10000, 10001) if i != v]))),
                ("integer_increment_decrement", lambda v: str(v + random.choice([i for i in range(-100, 101) if i != 0]))),
                ("integer_to_zero", lambda v: "0"),
            ]
            # Ici, on passe int_value (l'entier) à la lambda, pas la string
            name, func = random.choice(strategies)
            self.stats[name] += 1
            return func(int_value)
        except ValueError:
            self.stats["integer_parsing_error"] += 1
            return ""

    def _perturb_boolean(self, value: str) -> str:
        strategies = [
            ("boolean_flip", lambda v: "false" if v.lower() == "true" else "true"),
            ("boolean_to_empty", lambda v: ""),
            ("boolean_to_null", lambda v: "null"),
        ]
        return self._apply_strategy(strategies, value)

    def _perturb_null(self) -> str:
        strategies = [
            ("null_to_empty", lambda: ""),
            ("null_to_zero", lambda: "0"),
            ("null_to_false", lambda: "false"),
            ("null_to_random_int", lambda: str(random.randint(1, 10000))),
        ]
        return self._apply_strategy(strategies)

    def _perturb_empty_string(self) -> str:
        strategies = [
            ("empty_to_null", lambda: "null"),
            ("empty_to_random_int", lambda: str(random.randint(1, 10000))),
            ("empty_to_random_string", lambda: "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=random.randint(1, 5)))),
        ]
        return self._apply_strategy(strategies)
