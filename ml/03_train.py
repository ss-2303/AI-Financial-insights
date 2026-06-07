"""
ml/03_train.py
==============
Phase 1, Step 3 — Train the classifier

Input:   data/features_X.npy       (5004 × 503 feature matrix)
         data/features_y.npy       (5004 labels as integers)
         data/label_encoder.pkl    (integer ↔ category name)

Output:  models/classifier.pkl     (trained RandomForest model)

What this script does:
  1. Loads the feature matrix and labels from Step 2
  2. Splits into train (80%) and test (20%) sets
  3. Trains a RandomForest classifier
  4. Saves the trained model to models/classifier.pkl

Key concept — what "training" actually means:
  Training = the model looks at 4,003 rows (X_train, y_train)
  and adjusts its internal parameters until it can predict
  the category from the features as accurately as possible.

  After training, we test it on the 1,001 rows it never saw (X_test)
  to get an honest accuracy number. That happens in 04_evaluate.py.

Key concept — what a RandomForest is:
  A RandomForest builds many decision trees (n_estimators=200).
  Each tree learns a slightly different set of rules.
  To predict, all trees vote — the majority category wins.
  This makes it much more robust than a single decision tree.
"""

import numpy as np
import pickle
import time
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent.parent
DATA_DIR    = ROOT / "data"
MODELS_DIR  = ROOT / "models"

RANDOM_STATE = 42
TEST_SIZE    = 0.20     # 20% held out for evaluation
N_ESTIMATORS = 200      # number of decision trees in the forest
N_JOBS       = -1       # use all CPU cores

def main():
    print(f"\n{'─'*55}")
    print(f"  MODEL TRAINING")
    print(f"{'─'*55}")

    # 1. Load features and labels
    print(f"\n  Loading features...")
    X = np.load(DATA_DIR / "features_X.npy")
    y = np.load(DATA_DIR / "features_y.npy")

    with open(DATA_DIR / "label_encoder.pkl", "rb") as f:
        label_encoder = pickle.load(f)

    print(f"  X shape: {X.shape}  ({X.shape[0]} rows × {X.shape[1]} features)")
    print(f"  y shape: {y.shape}  ({len(label_encoder.classes_)} categories)")
    print(f"  Categories: {list(label_encoder.classes_)}")

    # 2. Train / test split
    # random_state=42 means the split is identical every run
    # stratify=y means the same category proportions in both sets
    print(f"\n  Splitting data (80% train / 20% test)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size    = TEST_SIZE,
        random_state = RANDOM_STATE,
        stratify     = y,
    )
    print(f"  Train: {X_train.shape[0]} rows")
    print(f"  Test:  {X_test.shape[0]} rows  ← model never sees these during training")

    # 3. Train RandomForest
    print(f"\n  Training RandomForest ({N_ESTIMATORS} trees)...")
    print(f"  This takes ~30–60 seconds on a laptop...")

    model = RandomForestClassifier(
        n_estimators      = N_ESTIMATORS,
        max_depth         = 30,     # enough depth for complex merchant patterns
        min_samples_split = 5,      # node needs 5+ rows to split
        min_samples_leaf  = 2,      # leaf needs 2+ rows
        max_features      = "sqrt", # each tree sees sqrt(506)≈22 random features
        class_weight      = "balanced",
        random_state      = RANDOM_STATE,
        n_jobs            = N_JOBS,
        verbose           = 0,
    )

    t0 = time.time()
    model.fit(X_train, y_train)
    elapsed = time.time() - t0

    print(f"  Done in {elapsed:.1f}s")

    # 4. Quick train accuracy (should be very high — model has seen this data)
    train_acc = model.score(X_train, y_train)
    test_acc  = model.score(X_test,  y_test)

    print(f"\n  Train accuracy: {train_acc*100:.1f}%")
    print(f"  Test accuracy:  {test_acc*100:.1f}%")

    # Explain the gap
    gap = train_acc - test_acc
    if gap > 0.10:
        print(f"\n  Note: {gap*100:.1f}% gap between train and test accuracy.")
        print(f"  This is called overfitting — the model memorised training data")
        print(f"  but generalises less well to new data.")
        print(f"  04_evaluate.py will show a full breakdown per category.")
    elif gap < 0.05:
        print(f"\n  Small gap ({gap*100:.1f}%) between train and test — model generalises well.")

    # 5. Save the model AND the test split so 04_evaluate.py can use them
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    model_payload = {
        "model":         model,
        "label_encoder": label_encoder,
        "feature_shape": X.shape,
        "n_estimators":  N_ESTIMATORS,
        "test_accuracy": test_acc,
        "train_accuracy": train_acc,
    }

    with open(MODELS_DIR / "classifier.pkl", "wb") as f:
        pickle.dump(model_payload, f)

    # Save test split separately so 04_evaluate.py doesn't need to re-split
    np.save(DATA_DIR / "X_test.npy", X_test)
    np.save(DATA_DIR / "y_test.npy", y_test)

    print(f"\n{'─'*55}")
    print(f"  FILES SAVED:")
    print(f"    models/classifier.pkl   trained model + metadata")
    print(f"    data/X_test.npy         test features (for evaluation)")
    print(f"    data/y_test.npy         test labels   (for evaluation)")
    print(f"{'─'*55}")
    print(f"\n  Next step: run ml/04_evaluate.py\n")


if __name__ == "__main__":
    main()