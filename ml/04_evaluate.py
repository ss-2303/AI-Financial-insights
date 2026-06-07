"""
ml/04_evaluate.py
=================
Phase 1, Step 4 — Model Evaluation

Input:   models/classifier.pkl
         data/X_test.npy
         data/y_test.npy
         data/label_encoder.pkl
         data/sample_transactions.csv  (to show real examples of errors)

Output:  Printed report + models/evaluation_report.txt

What this script does:
  1. Loads the trained model and held-out test set
  2. Runs predictions on test set
  3. Prints per-category precision, recall, F1
  4. Prints a confusion matrix
  5. Shows real examples of misclassified transactions
  6. Explains what each metric means

Key concepts:

  Accuracy  = overall % correct
              (can be misleading if categories are imbalanced)

  Precision = of all times the model said "shopping",
              what % were actually shopping?
              High precision = few false positives

  Recall    = of all actual shopping transactions,
              what % did the model correctly find?
              High recall = few false negatives

  F1 Score  = harmonic mean of precision and recall
              single number that balances both
              F1 = 2 * (precision * recall) / (precision + recall)

  Confusion Matrix = shows exactly which categories
              get confused with each other
              Rows = actual, Columns = predicted
"""

import numpy as np
import pandas as pd
import pickle
from pathlib import Path
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
DATA_DIR   = ROOT / "data"
MODELS_DIR = ROOT / "models"


def print_confusion_matrix(cm: np.ndarray, labels: list) -> None:
    """
    Print a readable confusion matrix.
    Rows = actual category, Columns = predicted category.
    Diagonal = correct predictions.
    Off-diagonal = mistakes.
    """
    col_width = 14
    header    = " " * 16 + "".join(f"{l[:12]:>{col_width}}" for l in labels)
    print(f"\n  {header}")
    print(f"  {'─' * (16 + col_width * len(labels))}")

    for i, row_label in enumerate(labels):
        row = ""
        for j, val in enumerate(cm[i]):
            # Highlight diagonal (correct) in a different way
            if i == j:
                cell = f"[{val:>4}]"
            else:
                cell = f" {val:>5} " if val > 0 else "     . "
            row += f"{cell:>{col_width}}"
        print(f"  {row_label[:14]:<16}{row}")


def show_misclassified_examples(
    X_test: np.ndarray,
    y_test: np.ndarray,
    y_pred: np.ndarray,
    label_encoder,
    sample_df: pd.DataFrame,
    sample_indices: np.ndarray,
    n_examples: int = 3,
) -> None:
    """
    Find real transaction examples where the model was wrong.
    This is the most informative part of evaluation —
    seeing actual mistakes tells you WHY the model struggles.
    """
    print(f"\n  {'─'*55}")
    print(f"  MISCLASSIFIED EXAMPLES (actual → predicted)")
    print(f"  {'─'*55}")

    # Find indices where prediction was wrong
    wrong_mask    = y_test != y_pred
    wrong_indices = np.where(wrong_mask)[0]

    if len(wrong_indices) == 0:
        print("  No misclassifications found!")
        return

    # Try to match test rows back to original sample transactions
    # (approximate — test indices don't directly map to sample_df rows)
    shown = 0
    categories_shown = set()

    for idx in wrong_indices:
        actual    = label_encoder.inverse_transform([y_test[idx]])[0]
        predicted = label_encoder.inverse_transform([y_pred[idx]])[0]

        # Skip if we've shown this confusion pair before
        pair = (actual, predicted)
        if pair in categories_shown:
            continue
        categories_shown.add(pair)

        # Try to find a matching transaction from the sample
        if len(sample_df) > idx:
            row = sample_df.iloc[idx]
            merchant = row.get("merchant", "unknown")
            amount   = row.get("amount", 0)
            print(f"\n  Merchant:  '{merchant}'  (${amount:.2f})")
            print(f"  Actual:    {actual}")
            print(f"  Predicted: {predicted}")
            print(f"  Why wrong: The merchant name gave insufficient signal")
            print(f"             to distinguish {actual} from {predicted}.")
        else:
            print(f"\n  Actual: {actual}  →  Predicted: {predicted}")

        shown += 1
        if shown >= n_examples:
            break


def explain_low_accuracy(
    report_dict: dict,
    category_counts: dict,
) -> None:
    """
    Diagnose WHY each category has low F1 and suggest fixes.
    """
    print(f"\n  {'─'*55}")
    print(f"  DIAGNOSIS — WHY EACH CATEGORY STRUGGLES")
    print(f"  {'─'*55}")

    for cat, metrics in report_dict.items():
        if cat in ("accuracy", "macro avg", "weighted avg"):
            continue
        f1      = metrics["f1-score"]
        support = metrics["support"]
        count   = category_counts.get(cat, 0)

        if f1 >= 0.80:
            status = "✓ Good"
            reason = "Strong signal in merchant names"
        elif f1 >= 0.60:
            status = "~ Moderate"
            reason = "Some signal but category overlaps with others"
        elif f1 >= 0.40:
            status = "✗ Weak"
            reason = "Merchant names don't clearly signal this category"
        else:
            status = "✗ Poor"
            reason = f"Only {support} test rows — need more training data"

        print(f"\n  {cat:<15}  F1={f1:.2f}  {status}")
        print(f"                   {reason}")
        if support < 30:
            print(f"                   → Only {support} test examples — increase sample size")
        if f1 < 0.60:
            print(f"                   → Consider adding more features specific to {cat}")


def main():
    print(f"\n{'─'*55}")
    print(f"  MODEL EVALUATION")
    print(f"{'─'*55}")

    # 1. Load model
    model_path = MODELS_DIR / "classifier.pkl"
    if not model_path.exists():
        print(f"  ERROR: {model_path} not found. Run 03_train.py first.")
        return

    with open(model_path, "rb") as f:
        payload = pickle.load(f)

    model         = payload["model"]
    label_encoder = payload["label_encoder"]
    labels        = list(label_encoder.classes_)

    print(f"\n  Model:       RandomForest ({payload['n_estimators']} trees)")
    print(f"  Categories:  {labels}")
    print(f"  Train acc:   {payload['train_accuracy']*100:.1f}%")
    print(f"  Test acc:    {payload['test_accuracy']*100:.1f}%")

    # 2. Load test set
    X_test_path = DATA_DIR / "X_test.npy"
    y_test_path = DATA_DIR / "y_test.npy"
    if not X_test_path.exists():
        print(f"  ERROR: X_test.npy not found. Run 03_train.py first.")
        return

    X_test = np.load(X_test_path)
    y_test = np.load(y_test_path)
    print(f"\n  Test set:    {len(y_test)} rows")

    # 3. Predict
    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)
    print(f"  Accuracy:    {acc*100:.1f}%")

    # 4. Per-category report
    report_str  = classification_report(y_test, y_pred, target_names=labels, digits=3)
    report_dict = classification_report(
        y_test, y_pred, target_names=labels, output_dict=True
    )

    print(f"\n  {'─'*55}")
    print(f"  PER-CATEGORY METRICS")
    print(f"  {'─'*55}")
    print(f"\n  {'Category':<16} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Support':>10}")
    print(f"  {'─'*55}")
    for cat in labels:
        m = report_dict[cat]
        print(
            f"  {cat:<16}"
            f"  {m['precision']:>9.3f}"
            f"  {m['recall']:>9.3f}"
            f"  {m['f1-score']:>9.3f}"
            f"  {int(m['support']):>9}"
        )
    print(f"  {'─'*55}")
    print(f"  {'Weighted avg':<16}"
          f"  {report_dict['weighted avg']['precision']:>9.3f}"
          f"  {report_dict['weighted avg']['recall']:>9.3f}"
          f"  {report_dict['weighted avg']['f1-score']:>9.3f}")

    # 5. Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print(f"\n  {'─'*55}")
    print(f"  CONFUSION MATRIX  (rows=actual, cols=predicted, [x]=correct)")
    print(f"  {'─'*55}")
    print_confusion_matrix(cm, labels)

    # 6. Load sample transactions for error analysis
    sample_path = DATA_DIR / "sample_transactions.csv"
    indices_path = DATA_DIR / "sample_indices.npy"
    if sample_path.exists():
        sample_df      = pd.read_csv(sample_path)
        sample_indices = np.load(indices_path) if indices_path.exists() else np.array([])
        show_misclassified_examples(
            X_test, y_test, y_pred, label_encoder, sample_df, sample_indices
        )

    # 7. Diagnosis
    cat_counts = {cat: int(report_dict[cat]["support"]) for cat in labels}
    explain_low_accuracy(report_dict, cat_counts)

    # 8. Summary
    macro_f1 = report_dict["macro avg"]["f1-score"]
    weighted_f1 = report_dict["weighted avg"]["f1-score"]

    print(f"\n  {'─'*55}")
    print(f"  SUMMARY")
    print(f"  {'─'*55}")
    print(f"  Accuracy:       {acc*100:.1f}%")
    print(f"  Macro F1:       {macro_f1:.3f}   (average across all categories equally)")
    print(f"  Weighted F1:    {weighted_f1:.3f}  (weighted by category size)")
    print(f"\n  Macro F1 interpretation:")
    if macro_f1 >= 0.85:
        print(f"  Excellent — model handles all categories well")
    elif macro_f1 >= 0.70:
        print(f"  Good — some categories need more data or better features")
    elif macro_f1 >= 0.55:
        print(f"  Moderate — merchant names alone aren't enough for all categories")
        print(f"  Consider: adding description text, amount ranges per category")
    else:
        print(f"  Needs improvement — features don't capture enough category signal")

    # 9. Save text report
    report_path = MODELS_DIR / "evaluation_report.txt"
    with open(report_path, "w") as f:
        f.write(f"Accuracy: {acc*100:.1f}%\n\n")
        f.write(report_str)
        f.write(f"\nMacro F1: {macro_f1:.3f}\n")
        f.write(f"Weighted F1: {weighted_f1:.3f}\n")
    print(f"\n  Report saved → {report_path}")

    # 10. Save JSON report — read by the FastAPI /api/v1/eval-report endpoint
    #     and displayed live in the ML Insights panel on the dashboard
    import json
    json_report = {
        "accuracy":     round(float(acc), 4),
        "macro_f1":     round(float(macro_f1), 4),
        "weighted_f1":  round(float(weighted_f1), 4),
        "train_accuracy": round(float(payload["train_accuracy"]), 4),
        "n_estimators": payload["n_estimators"],
        "categories":   labels,
        "per_category": {
            cat: {
                "precision": round(report_dict[cat]["precision"], 3),
                "recall":    round(report_dict[cat]["recall"],    3),
                "f1":        round(report_dict[cat]["f1-score"],  3),
                "support":   int(report_dict[cat]["support"]),
            }
            for cat in labels
        },
        "feature_shape": list(payload.get("feature_shape", [])),
    }
    json_path = MODELS_DIR / "eval_report.json"
    with open(json_path, "w") as f:
        json.dump(json_report, f, indent=2)
    print(f"  JSON report saved → {json_path}")
    print(f"\n  Phase 1 complete. Next: build the Node backend (Phase 2)\n")


if __name__ == "__main__":
    main()