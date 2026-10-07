"""BR-13: check a request's features against the feature schema."""

import math
from collections.abc import Sequence
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

REQUIRED = "This value is required."
UNKNOWN_FIELD = "Unknown field."
NOT_A_NUMBER = "Must be a number."
NOT_FINITE = "Must be a finite number."
NOT_INTEGER = "Must be a whole number."
NOT_BOOLEAN = "Must be true or false."


class InvalidInput(Exception):
    """One or more FieldError entries (API_CONTRACT §1); every problem is reported together."""

    def __init__(self, details: list[dict]):
        super().__init__(f"{len(details)} invalid input(s)")
        self.details = details

    @property
    def message(self) -> str:
        count = len(self.details)
        return "1 input needs attention." if count == 1 else f"{count} inputs need attention."


def _bound(value: float, step: float, rounding: str) -> str:
    """A range limit at the feature's display precision, rounded into the range, so that every
    value between the two printed limits is accepted."""
    text = format(Decimal(str(value)).quantize(Decimal(str(step)), rounding=rounding), "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def range_message(entry: dict) -> str:
    low = _bound(entry["min"], entry["step"], ROUND_CEILING)
    high = _bound(entry["max"], entry["step"], ROUND_FLOOR)
    return f"Must be between {low} and {high} (range seen in the dataset)."


def allowed_message(entry: dict) -> str:
    return f"Must be one of: {', '.join(entry['categories'])}."


def _check(entry: dict, value) -> tuple[str, str] | None:
    """(issue, message) for an invalid value, None for a valid one."""
    if entry["type"] == "numeric":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return "wrong_type", NOT_A_NUMBER
        if isinstance(value, float) and not math.isfinite(value):
            return "not_finite", NOT_FINITE
        if entry["integer"] and isinstance(value, float) and not value.is_integer():
            return "not_integer", NOT_INTEGER
        if not entry["min"] <= value <= entry["max"]:
            return "out_of_range", range_message(entry)
    elif entry["type"] == "binary":
        if not isinstance(value, bool):
            return "wrong_type", NOT_BOOLEAN
    elif not isinstance(value, str):
        return "wrong_type", allowed_message(entry)
    elif value not in entry["categories"]:
        return "not_allowed", allowed_message(entry)
    return None


def validate_features(features: dict, schema: Sequence[dict]) -> dict:
    """Canonical values in schema order; raises InvalidInput listing every problem."""
    details, canonical = [], {}
    for entry in schema:
        name = entry["id"]
        value = features.get(name)
        problem = ("missing", REQUIRED) if value is None else _check(entry, value)
        if problem:
            details.append({"field": name, "issue": problem[0], "message": problem[1]})
        elif entry["type"] == "numeric":
            canonical[name] = int(value) if entry["integer"] else float(value)
        else:
            canonical[name] = value
    known = {entry["id"] for entry in schema}
    details += [
        {"field": name, "issue": "unknown_field", "message": UNKNOWN_FIELD}
        for name in sorted(set(features) - known)
    ]
    if details:
        raise InvalidInput(details)
    return canonical
