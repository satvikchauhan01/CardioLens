"""Canonical values -> model matrix (DATA_MODEL §5.2), fitted inside each pipeline."""

from collections.abc import Sequence

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

from ml.dataset import assert_no_leakage


def build_preprocessor(schema: Sequence[dict]) -> ColumnTransformer:
    """Unfitted ColumnTransformer for the given FeatureSchema entries."""
    assert_no_leakage(entry["id"] for entry in schema)
    of_type = {
        kind: [entry for entry in schema if entry["type"] == kind]
        for kind in ("numeric", "binary", "ordinal", "categorical")
    }

    def ids(kind: str) -> list[str]:
        return [entry["id"] for entry in of_type[kind]]

    def categories(kind: str) -> list[list[str]]:
        return [entry["categories"] for entry in of_type[kind]]

    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), ids("numeric")),
            ("binary", "passthrough", ids("binary")),
            ("ordinal", OrdinalEncoder(categories=categories("ordinal")), ids("ordinal")),
            (
                "categorical",
                OneHotEncoder(
                    categories=categories("categorical"), handle_unknown="ignore", sparse_output=False
                ),
                ids("categorical"),
            ),
        ],
        remainder="drop",
        sparse_threshold=0.0,
    )


def transformed_to_feature(preprocessor: ColumnTransformer) -> list[str]:
    """Original feature id of every column a fitted preprocessor outputs, in output order."""
    mapping: list[str] = []
    for name, transformer, columns in preprocessor.transformers_:
        if name == "remainder" or len(columns) == 0:
            continue
        if isinstance(transformer, OneHotEncoder):
            for column, levels in zip(columns, transformer.categories_):
                mapping += [column] * len(levels)
        else:
            mapping += list(columns)
    return mapping
