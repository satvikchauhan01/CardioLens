"""Cross-validated evaluation of the candidate models (DATA_MODEL §6) and the evaluation plots."""

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from matplotlib.axes import Axes
from matplotlib.figure import Figure
from matplotlib.patches import Rectangle
from sklearn.base import clone
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import RepeatedStratifiedKFold

from ml.config import (
    CALIBRATION_BINS,
    DECISION_THRESHOLD,
    N_REPEATS,
    N_SPLITS,
    SEED,
    SELECTION_TOLERANCE,
    Target,
)
from ml.models import BASELINE, MODEL_LABELS, MODEL_TYPES, make_pipeline

METRICS = (
    "accuracy", "precision", "recall", "specificity", "f1", "roc_auc", "average_precision", "brier",
)


def predict_positive(probabilities, threshold: float = DECISION_THRESHOLD) -> np.ndarray:
    """BR-3: the positive class is predicted when probability >= threshold."""
    return np.asarray(probabilities, dtype=float) >= threshold


def specificity_score(y_true, y_pred) -> float:
    """True negatives / all negatives; 0 when there are no negatives."""
    negatives = np.asarray(y_true) == 0
    if not negatives.any():
        return 0.0
    return float((np.asarray(y_pred)[negatives] == 0).mean())


def fold_metrics(y_true, probabilities, threshold: float = DECISION_THRESHOLD) -> dict[str, float]:
    y_true = np.asarray(y_true)
    predicted = predict_positive(probabilities, threshold).astype(int)
    return {
        "accuracy": float(accuracy_score(y_true, predicted)),
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
        "specificity": specificity_score(y_true, predicted),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "brier": float(brier_score_loss(y_true, probabilities)),
    }


@dataclass(frozen=True)
class CrossValidation:
    metrics: dict[str, dict[str, dict[str, float]]]  # model -> metric -> {"mean", "std"} over folds
    out_of_fold: dict[str, np.ndarray]  # model -> P(positive) per row, from repeat 1


def cross_validate(
    features: pd.DataFrame,
    labels,
    schema: Sequence[dict],
    model_types: Sequence[str] = (*MODEL_TYPES, BASELINE),
    n_splits: int = N_SPLITS,
    n_repeats: int = N_REPEATS,
    seed: int = SEED,
) -> CrossValidation:
    """Repeated stratified k-fold; the whole pipeline, preprocessing included, is refitted per fold."""
    y = np.asarray(labels)
    splitter = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=seed)
    splits = list(splitter.split(features, y))

    metrics, out_of_fold = {}, {}
    for model_type in model_types:
        pipeline = make_pipeline(model_type, schema)
        scores = []
        first_repeat = np.full(len(y), np.nan)
        for fold, (train, test) in enumerate(splits):
            fitted = clone(pipeline).fit(features.iloc[train], y[train])
            probabilities = fitted.predict_proba(features.iloc[test])[:, 1]
            scores.append(fold_metrics(y[test], probabilities))
            if fold < n_splits:  # repeat 1 predicts every row exactly once
                first_repeat[test] = probabilities
        metrics[model_type] = {
            name: {
                "mean": float(np.mean([score[name] for score in scores])),
                "std": float(np.std([score[name] for score in scores])),
            }
            for name in METRICS
        }
        out_of_fold[model_type] = first_repeat
    return CrossValidation(metrics=metrics, out_of_fold=out_of_fold)


def select_model(metrics: dict[str, dict[str, dict[str, float]]]) -> tuple[str, str]:
    """D-013: highest mean ROC-AUC; logistic regression wins when it is within the tolerance."""
    auc = {model_type: metrics[model_type]["roc_auc"]["mean"] for model_type in MODEL_TYPES}
    best = max(MODEL_TYPES, key=auc.get)
    simplest = MODEL_TYPES[0]
    if best != simplest and auc[best] - auc[simplest] <= SELECTION_TOLERANCE:
        return simplest, f"Within {SELECTION_TOLERANCE:g} of best; simplest model preferred"
    return best, "Highest mean ROC-AUC"


# --- Plots ---------------------------------------------------------------------------------------
# Static PNGs for the Model & method tab and the report (D-022). Colors identify the model, never
# its rank, and avoid the app's teal/amber/crimson risk colors. Checked with the dataviz palette
# validator (all pairs, light surface): colour-vision-deficiency ΔE 13.0, normal-vision ΔE 16.3.

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"
MODEL_COLORS = {
    "logistic_regression": "#2a78d6",
    "random_forest": "#4a3aa7",
    "gradient_boosting": "#e87ba4",
}
# One hue, light -> dark, for the confusion-matrix cells.
SEQUENTIAL = (
    "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
    "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
)
FIGURE_SIZE = (4.6, 4.3)
DPI = 200


def _figure(title: str, subtitle: str) -> tuple[Figure, Axes]:
    figure = Figure(figsize=FIGURE_SIZE, dpi=DPI, facecolor=SURFACE)
    axes = figure.add_axes((0.15, 0.13, 0.80, 0.69))
    axes.set_facecolor(SURFACE)
    figure.text(0.04, 0.95, title, fontsize=10.5, fontweight="bold", color=INK, va="center")
    figure.text(0.04, 0.895, subtitle, fontsize=7.5, color=INK_SECONDARY, va="center")
    return figure, axes


def _style_unit_axes(axes: Axes, x_label: str, y_label: str) -> None:
    """Shared look for the two plots whose axes both run from 0 to 1."""
    ticks = np.linspace(0, 1, 6)
    axes.set(xlim=(-0.015, 1.015), ylim=(-0.015, 1.015), xticks=ticks, yticks=ticks, aspect="equal")
    axes.set_xlabel(x_label, fontsize=8, color=INK_SECONDARY, labelpad=6)
    axes.set_ylabel(y_label, fontsize=8, color=INK_SECONDARY, labelpad=6)
    axes.grid(color=GRID, linewidth=0.6)
    axes.set_axisbelow(True)
    axes.tick_params(colors=INK_SECONDARY, labelsize=7.5, length=0, pad=5)
    for side in ("top", "right"):
        axes.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        axes.spines[side].set_color(AXIS)
        axes.spines[side].set_linewidth(0.8)


def _reference_diagonal(axes: Axes, label: str) -> None:
    axes.plot([0, 1], [0, 1], color=AXIS, linewidth=0.8, zorder=1)
    axes.text(
        0.70, 0.665, label, rotation=45, rotation_mode="anchor", fontsize=7, color=INK_MUTED,
        ha="center", va="top",
    )


def plot_roc(path: Path, title: str, subtitle: str, labels, out_of_fold: dict, selected: str) -> None:
    figure, axes = _figure(title, subtitle)
    _style_unit_axes(axes, "False positive rate (1 − specificity)", "True positive rate (recall)")
    _reference_diagonal(axes, "chance")
    for model_type in MODEL_TYPES:
        false_positive, true_positive, _ = roc_curve(labels, out_of_fold[model_type])
        area = roc_auc_score(labels, out_of_fold[model_type])
        chosen = model_type == selected
        axes.plot(
            false_positive,
            true_positive,
            color=MODEL_COLORS[model_type],
            linewidth=2.2 if chosen else 1.3,
            solid_capstyle="round",
            solid_joinstyle="round",
            zorder=3 if chosen else 2,
            label=f"{MODEL_LABELS[model_type]}{' (selected)' if chosen else ''} · AUC {area:.2f}",
        )
    axes.legend(loc="lower right", frameon=False, fontsize=7.5, labelcolor=INK, handlelength=1.6)
    figure.savefig(path)


def plot_calibration(path: Path, title: str, subtitle: str, labels, probabilities) -> None:
    figure, axes = _figure(title, subtitle)
    _style_unit_axes(axes, "Mean predicted probability (per bin)", "Observed fraction positive")
    _reference_diagonal(axes, "perfect calibration")
    observed, predicted = calibration_curve(
        labels, probabilities, n_bins=CALIBRATION_BINS, strategy="quantile"
    )
    axes.plot(
        predicted,
        observed,
        color=SEQUENTIAL[7],
        linewidth=1.5,
        marker="o",
        markersize=6.5,
        markeredgecolor=SURFACE,
        markeredgewidth=1.5,
        solid_capstyle="round",
        zorder=3,
    )
    figure.savefig(path)


def _ink_on(fill: str) -> str:
    """White or ink, whichever reads on the given fill."""
    red, green, blue = (int(fill[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return "#ffffff" if 0.2126 * red + 0.7152 * green + 0.0722 * blue < 0.45 else INK


def plot_confusion(
    path: Path, title: str, subtitle: str, labels, probabilities, negative: str, positive: str
) -> None:
    actual = np.asarray(labels) == 1
    predicted = predict_positive(probabilities)
    counts = np.array(
        [
            [np.sum(~actual & ~predicted), np.sum(~actual & predicted)],
            [np.sum(actual & ~predicted), np.sum(actual & predicted)],
        ]
    )
    figure, axes = _figure(title, subtitle)
    axes.set_position((0.25, 0.08, 0.70, 0.70))
    axes.set(xlim=(0, 2), ylim=(2, 0), aspect="equal")
    axes.axis("off")
    gap = 0.012  # surface gap between cells
    for row in range(2):
        for column in range(2):
            count = int(counts[row, column])
            shade = SEQUENTIAL[round(count / counts.max() * (len(SEQUENTIAL) - 1))]
            axes.add_patch(
                Rectangle((column + gap, row + gap), 1 - 2 * gap, 1 - 2 * gap, color=shade, linewidth=0)
            )
            share = count / counts[row].sum()
            axes.text(
                column + 0.5, row + 0.46, str(count), ha="center", va="center",
                fontsize=17, fontweight="bold", color=_ink_on(shade),
            )
            axes.text(
                column + 0.5, row + 0.68, f"{share:.0%} of row", ha="center", va="center",
                fontsize=7.5, color=_ink_on(shade),
            )
    for column, text in enumerate(("Model: not predicted", "Model: predicted")):
        axes.text(column + 0.5, -0.07, text, ha="center", va="bottom", fontsize=8, color=INK_SECONDARY)
    for row, text in enumerate((negative, positive)):
        axes.text(
            -0.07, row + 0.5, f"Dataset label:\n{text}", ha="right", va="center", fontsize=8,
            color=INK_SECONDARY, linespacing=1.4,
        )
    figure.savefig(path)


def write_plots(
    plots_dir: Path, target: Target, labels, validation: CrossValidation, selected: str
) -> dict[str, str]:
    """Write the three evaluation plots for one target; returns their URL paths (API_CONTRACT §7)."""
    labels = np.asarray(labels)
    note = f"Out-of-fold predictions, repeat 1 · n = {len(labels)}"
    chosen = MODEL_LABELS[selected]
    name = target.short_label
    probabilities = validation.out_of_fold[selected]

    plot_roc(
        plots_dir / f"{target.id}_roc.png", f"{name} · ROC curve", f"{note} · AUC pooled over folds",
        labels, validation.out_of_fold, selected,
    )
    plot_calibration(
        plots_dir / f"{target.id}_calibration.png", f"{name} · Calibration ({chosen})",
        f"{note} · {CALIBRATION_BINS} quantile bins", labels, probabilities,
    )
    plot_confusion(
        plots_dir / f"{target.id}_confusion.png", f"{name} · Confusion matrix ({chosen})",
        f"{note} · threshold {DECISION_THRESHOLD:g}", labels, probabilities,
        target.negative, target.positive,
    )
    return {
        kind: f"/static/plots/{target.id}_{kind}.png" for kind in ("roc", "calibration", "confusion")
    }
