import random
import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import uuid


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

    def _perturb_string(self, value: str) -> str:
        """
        Perturb a string value.
        Strategies: empty string, random character substitution, truncation, reversal
        """
        strategies = [
            lambda v: "",  # Empty string
            lambda v: self._substitute_characters(v),  # Random substitution
            lambda v: v[:len(v)//2] if len(v) > 1 else "",  # Truncation
            lambda v: v[::-1] if len(v) > 1 else v,  # Reversal
        ]
        return random.choice(strategies)(value)

    def _substitute_characters(self, value: str) -> str:
        """Randomly substitute some characters in a string."""
        if len(value) == 0:
            return value
        value_list = list(value)
        num_substitutions = random.randint(1, max(1, len(value) // 2))
        indices = random.sample(range(len(value_list)), num_substitutions)
        for idx in indices:
            value_list[idx] = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
        return "".join(value_list)

    def _perturb_uuid(self, value: str) -> str:
        """
        Perturb a UUID value.
        Strategies: random UUID, null, empty string, partial modification
        """
        strategies = [
            lambda v: str(uuid.uuid4()),  # Generate new random UUID
            lambda v: "",  # Empty string
            lambda v: "null",  # Null
            lambda v: self._mutate_uuid(v),  # Mutate some hex digits
        ]
        return random.choice(strategies)(value)

    def _mutate_uuid(self, value: str) -> str:
        """Randomly mutate some hex digits in a UUID."""
        value_list = list(value)
        # Find indices of hex characters (not dashes)
        hex_indices = [i for i, c in enumerate(value_list) if c != "-"]
        if hex_indices:
            num_mutations = random.randint(1, max(1, len(hex_indices) // 3))
            mutation_indices = random.sample(hex_indices, num_mutations)
            for idx in mutation_indices:
                value_list[idx] = random.choice("0123456789abcdef")
        return "".join(value_list)

    def _perturb_date(self, value: str) -> str:
        """
        Perturb a date value.
        Strategies: null, empty string, random date, date shift, invalid date format
        """
        strategies = [
            lambda v: "",  # Empty string
            lambda v: "null",  # Null
            lambda v: self._generate_random_date(),  # Random date
            lambda v: self._shift_date(v),  # Shift date by random days
        ]
        return random.choice(strategies)(value)

    def _generate_random_date(self) -> str:
        """Generate a random ISO 8601 date string."""
        # Random date between 1970 and 2050
        start_year = 1970
        end_year = 2050
        random_year = random.randint(start_year, end_year)
        random_month = random.randint(1, 12)
        random_day = random.randint(1, 28)  # Use 28 to avoid month-specific issues
        random_hour = random.randint(0, 23)
        random_minute = random.randint(0, 59)
        random_second = random.randint(0, 59)

        # Match original format (with or without milliseconds, with or without Z)
        return f"{random_year:04d}-{random_month:02d}-{random_day:02d}T{random_hour:02d}:{random_minute:02d}:{random_second:02d}"

    def _shift_date(self, value: str) -> str:
        """Shift a date by a random number of days."""
        try:
            # Parse the date (try multiple formats)
            date_obj = None
            for fmt in ["%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]:
                try:
                    date_obj = datetime.strptime(value.rstrip("Z"), fmt.replace("Z", ""))
                    break
                except ValueError:
                    continue

            if date_obj:
                # Shift by random days (positive or negative, within 365 days)
                shift_days = random.randint(-365, 365)
                shifted_date = date_obj + timedelta(days=shift_days)
                # Return in same format as input
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
        """
        Perturb an integer value.
        Strategies: null, empty string, random integer, increment/decrement, zero
        """
        try:
            int_value = int(value)
            strategies = [
                lambda v: "",  # Empty string
                lambda v: "null",  # Null
                lambda v: str(random.randint(-10000, 10000)),  # Random integer
                lambda v: str(v + random.randint(-100, 100)),  # Increment/decrement
                lambda v: "0",  # Zero
            ]
            return random.choice(strategies)(int_value)
        except ValueError:
            return ""

    def _perturb_boolean(self, value: str) -> str:
        """
        Perturb a boolean value.
        Strategies: flip, null, empty string
        """
        strategies = [
            lambda v: "false" if v.lower() == "true" else "true",  # Flip
            lambda v: "",  # Empty string
            lambda v: "null",  # Null
        ]
        return random.choice(strategies)(value)

    def _perturb_null(self) -> str:
        """
        Perturb a null value.
        Strategies: empty string, random string, random value of appropriate type
        """
        strategies = [
            lambda: "",  # Empty string
            lambda: "0",  # Default integer
            lambda: "false",  # Default boolean
            lambda: "null",  # Keep null
        ]
        return random.choice(strategies)()

    def _perturb_empty_string(self) -> str:
        """
        Perturb an empty string.
        Strategies: null, random string, keep empty
        """
        strategies = [
            lambda: "",  # Keep empty
            lambda: "null",  # Null
            lambda: "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=random.randint(1, 5))),  # Random string
        ]
        return random.choice(strategies)()
