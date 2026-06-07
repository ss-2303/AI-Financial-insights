"""
ml/02_features.py
=================
Phase 1, Step 2 — Feature Engineering

Input:   data/processed_transactions.csv
Output:  data/features_X.npy, features_y.npy,
         data/vectorizer.pkl, data/label_encoder.pkl,
         data/scaler.pkl, data/sample_transactions.csv

Why TF-IDF works now (it didn't on the fraud dataset):
  Fraud dataset merchants: "Rippin Kub And Mann"  ← fake, no signal
  This dataset merchants:  "DELTA AIR", "AMAZON", "USPS"  ← real signal

  TF-IDF learns that:
    "delta air"  →  transport
    "amazon"     →  shopping
    "usps"       →  utilities
    "marriott"   →  entertainment

  The merchant name is now the strongest feature.

Feature strategy:
  Text (500):  TF-IDF on merchant name (unigrams + bigrams)
  Numerical (6): amount, log_amount, sqrt_amount, bucket, is_small, is_large
  Total:       506 features
"""

import numpy as np
import pandas as pd
import pickle
from pathlib import Path
from scipy.sparse import hstack, csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder, StandardScaler

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).resolve().parent.parent
CLEAN_PATH = ROOT / "data" / "processed_transactions.csv"
DATA_DIR   = ROOT / "data"

SAMPLE_SIZE  = 8_000    # larger sample — dataset is high quality
TFIDF_MAX    = 500
RANDOM_STATE = 42


def stratified_sample(df, n, random_state):
    """
    Sample n rows keeping the same category proportions as the full dataset.
    Built as a for loop to avoid pandas 2.x groupby.apply column-drop issue.
    """
    frames = []
    for _cat, group in df.groupby("category"):
        n_cat = min(len(group), int(np.ceil(n * len(group) / len(df))))
        frames.append(group.sample(n_cat, random_state=random_state))
    return (
        pd.concat(frames, ignore_index=True)
          .sample(frac=1, random_state=random_state)
          .reset_index(drop=True)
    )


def build_amount_features(df):
    """
    6 numerical features derived from amount.
    These complement TF-IDF — some categories (travel, lodging)
    have consistently high amounts regardless of merchant name.
    """
    amt = df["amount"].values
    return np.hstack([
        amt.reshape(-1, 1),                                      # raw
        np.log1p(amt).reshape(-1, 1),                            # log scale
        np.sqrt(amt).reshape(-1, 1),                             # sqrt scale
        np.digitize(amt, bins=[10, 25, 75, 200, 500, 2000]).reshape(-1, 1),  # band
        (amt < 10).astype(float).reshape(-1, 1),                 # is_small
        (amt > 500).astype(float).reshape(-1, 1),                # is_large
    ])


def main():
    print(f"\n{'─'*55}")
    print(f"  FEATURE ENGINEERING")
    print(f"{'─'*55}")

    print(f"\n  Loading {CLEAN_PATH.name}...")
    df = pd.read_csv(CLEAN_PATH)
    print(f"  Loaded {len(df):,} rows, {df['category'].nunique()} categories")

    # 1. Drop "other" — it's a catch-all with no clear signal.
    #    It causes the model to confuse dining/shopping/subscription
    #    with anything it's uncertain about.
    #    Also drop rare categories (< 500 rows).
    before = len(df)
    df = df[df["category"] != "other"].reset_index(drop=True)
    print(f"\n  Dropped 'other' category: {before - len(df):,} rows removed")

    cat_counts = df["category"].value_counts()
    rare_cats  = cat_counts[cat_counts < 500].index.tolist()
    if rare_cats:
        print(f"  Dropping rare categories (< 500 rows): {rare_cats}")
        df = df[~df["category"].isin(rare_cats)].reset_index(drop=True)
    print(f"  Remaining: {len(df):,} rows, {df['category'].nunique()} categories")

    # 2. Stratified sample
    print(f"\n  Taking stratified sample of {SAMPLE_SIZE:,} rows...")
    df_s = stratified_sample(df, SAMPLE_SIZE, RANDOM_STATE)
    print(f"  Sample size: {len(df_s):,}")
    print(f"\n  Category distribution:")
    for cat, n in df_s["category"].value_counts().items():
        bar = "█" * int(n / len(df_s) * 30)
        print(f"    {cat:<15}  {n:>5}  {n/len(df_s)*100:>5.1f}%  {bar}")

    # 2. Text feature: merchant name
    print(f"\n  Building TF-IDF features from merchant names...")
    texts = df_s["merchant"].fillna("unknown")
    print(f"  Example merchant: '{texts.iloc[0]}'")

    # Stop words: generic words that appear in every category = no signal
    stop_words = [
        "com", "inc", "llc", "ltd", "co", "corp", "and", "the", "of",
        "us", "usa", "vb", "na", "de", "le", "la", "st",
        "store", "stores", "shop", "shops", "company", "group",
        "services", "service", "solutions", "systems",
    ]

    vectorizer = TfidfVectorizer(
        max_features = TFIDF_MAX,
        ngram_range  = (1, 2),
        lowercase    = True,
        strip_accents= "unicode",
        min_df       = 2,
        stop_words   = stop_words,
    )
    X_text = vectorizer.fit_transform(texts)
    print(f"  TF-IDF matrix: {X_text.shape}")

    # Show top vocabulary — should now be real merchant words
    words  = vectorizer.get_feature_names_out()
    scores = np.asarray(X_text.sum(axis=0)).flatten()
    top20  = [words[i] for i in scores.argsort()[-20:][::-1]]
    print(f"  Top 20 vocabulary terms: {top20}")

    # 3. Numerical features
    print(f"\n  Building numerical features...")
    X_num = build_amount_features(df_s)
    print(f"  Numerical matrix: {X_num.shape}")

    # Scale numerical features
    scaler    = StandardScaler()
    X_num_sc  = scaler.fit_transform(X_num)

    # 4. Combine
    X = hstack([X_text, csr_matrix(X_num_sc)])
    print(f"\n  Combined matrix: {X.shape}  ({TFIDF_MAX} TF-IDF + 6 numerical)")

    # 5. Encode labels
    print(f"\n  Encoding labels...")
    le = LabelEncoder()
    y  = le.fit_transform(df_s["category"])
    print(f"  Label mapping:")
    for i, cat in enumerate(le.classes_):
        print(f"    {i} → {cat:<15} ({(y==i).sum()} rows)")

    # 6. Save
    print(f"\n  Saving...")
    np.save(DATA_DIR / "features_X.npy",     X.toarray())
    np.save(DATA_DIR / "features_y.npy",     y)
    np.save(DATA_DIR / "sample_indices.npy", df_s.index.values)

    with open(DATA_DIR / "vectorizer.pkl",    "wb") as f: pickle.dump(vectorizer, f)
    with open(DATA_DIR / "label_encoder.pkl", "wb") as f: pickle.dump(le, f)
    with open(DATA_DIR / "scaler.pkl",        "wb") as f: pickle.dump(scaler, f)

    df_s.to_csv(DATA_DIR / "sample_transactions.csv", index=False)

    print(f"\n{'─'*55}")
    print(f"  FILES SAVED:")
    print(f"    data/features_X.npy       {X.shape}")
    print(f"    data/features_y.npy       {y.shape}")
    print(f"    data/vectorizer.pkl")
    print(f"    data/label_encoder.pkl")
    print(f"    data/scaler.pkl")
    print(f"{'─'*55}")
    print(f"\n  Next: python ml/03_train.py\n")


if __name__ == "__main__":
    main()