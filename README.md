# Ethos Finance — AI-Powered Financial Insights Dashboard

A full-stack portfolio project that combines a RandomForest ML classifier, a Claude LLM agent, z-score anomaly detection, and a React dashboard to simulate an open banking analytics product.

---

## What it does

Upload (or stream from CSV) bank transactions → the ML pipeline classifies each one into a spending category → anomalies are flagged statistically → Claude generates personalised advice in plain English → everything surfaces in a real-time dashboard.

---

## Architecture

```
data/raw_transactions.csv  (US govt credit card dataset, 788K rows)
        │
        ▼
ml/01_normalise.py   →  data/processed_transactions.csv
ml/02_features.py   →  TF-IDF (500) + 6 numerical = 506-feature matrix
ml/03_train.py      →  models/classifier.pkl   (RandomForest, 200 trees)
ml/04_evaluate.py   →  models/eval_report.json (F1 per category)
        │
        ▼
backend/api/main.py          (FastAPI)
  POST /api/v1/analyze  →  classify + anomaly detect + Claude insights
  POST /api/v1/classify →  single-transaction classification
  GET  /api/v1/eval-report → live F1 scores for the ML panel
  GET  /api/v1/activity-log → in-memory event log
  WS   /ws              →  real-time activity stream
        │
        ▼
frontend/src/             (React + TypeScript + Vite)
  Dashboard  → metric cards, bar chart, fraud alerts, donut chart
  Transactions → full history, category badges
  ML Model modal → live eval metrics, F1 bars, limitations tab
  AI Insights modal → Claude summary + numbered recommendations
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML pipeline | Python, scikit-learn (RandomForest, TF-IDF), pandas, numpy |
| AI insights | Claude Sonnet (`claude-sonnet-4-6`) via Anthropic SDK |
| Backend | FastAPI, Uvicorn, PyJWT |
| Model hosting | Hugging Face Hub |
| Frontend | React 18, TypeScript, Vite, Recharts, Axios |
| Auth | JWT (demo mode, no database) |

---

## ML Pipeline

### Step 1 — Normalise (`ml/01_normalise.py`)
- Reads the raw US government procurement CSV (788K rows, real merchant names like `DELTA AIR`, `AMAZON`, `USPS`)
- Maps 255 `TranxDescription` values to 9 categories: groceries, dining, transport, utilities, shopping, healthcare, entertainment, subscription, other
- Cleans merchant names aggressively (removes store numbers, payment processor prefixes, brand abbreviations like `AMZN→amazon`, `STAPLS→staples`)
- Removes refunds, zero-amount rows, and duplicates

### Step 2 — Feature engineering (`ml/02_features.py`)
- Drops the `other` category (no learnable signal) and categories with < 500 rows
- Takes a stratified sample of 8,000 rows to preserve class proportions
- Builds a **506-dimensional feature matrix**: 500 TF-IDF unigram/bigram features from merchant names + 6 numerical amount features (raw, log, sqrt, bucket, is_small, is_large)
- Fits and saves the vectorizer, label encoder, and scaler

### Step 3 — Train (`ml/03_train.py`)
- 80/20 stratified train/test split
- RandomForest: 200 trees, `max_depth=30`, `class_weight="balanced"`, all CPU cores
- Saves `models/classifier.pkl` including model, vectorizer, label encoder

### Step 4 — Evaluate (`ml/04_evaluate.py`)
- Per-category precision, recall, F1, confusion matrix
- Saves `models/eval_report.json` — consumed live by the dashboard ML panel

### Model performance (current)

| Category | F1 | Notes |
|---|---|---|
| utilities | 0.93 | Strong — USPS, Verizon, AT&T are unambiguous |
| transport | 0.78 | Delta, United, shell — clear signal |
| groceries | 0.77 | Whole Foods, Costco — consistent |
| shopping | 0.70 | Highest volume (48% of data), high precision |
| entertainment | 0.66 | Hotels/lodging overlap with travel |
| subscription | 0.51 | Broad catch-all in source data |
| dining | 0.51 | Overlaps heavily with grocery merchants |
| healthcare | 0.40 | Very few rows; procurement data has little healthcare |

**Overall — test accuracy: 64.9% · macro F1: 0.657 · weighted F1: 0.678**

---

## Backend

`backend/api/main.py` is a single-file FastAPI service:

- **Classification**: tries the trained RandomForest first; falls back to keyword rules (8 categories, ~50 merchant keywords each) if the model is missing or inference fails
- **Anomaly detection**: z-score on transaction amounts; z > 1.8 → `medium`, z > 2.5 → `high`
- **Insights**: calls `generate_claude_insights()` in `financial_agent.py`; falls back to rule-based statistical insights if the Anthropic API key is absent
- **Auth**: demo-mode JWT — one hardcoded user (`test@test.com / password123`). Register returns a token but nothing is persisted
- **Model bootstrap**: on startup, downloads `classifier.pkl`, `eval_report.json`, and `processed_transactions.csv` from Hugging Face if they are not present locally

---

## Frontend

Single-page React app with two tabs and three modals:

**Dashboard tab**
- Three metric cards: Total Spend, Transaction count, Fraud Alerts
- Daily bar chart (last 15 days, Recharts)
- Fraud Alerts card (z-score anomalies, severity badge)
- Spending Categories donut chart — click any slice to expand top-3 merchants
- Subscriptions section — new vs continuing, derived from ML-classified data
- AI Insights card — expandable, shows Claude summary + numbered recommendations

**History tab**
- Full transaction table with date, vendor, category badge, amount

**ML Model modal** (sidebar → "ML Model")
- Overview tab: algorithm, accuracy, train/test gap, pipeline summary
- Evaluation tab: per-category F1 bar chart from live `eval_report.json`
- Why RF tab: rationale + alternatives considered (Logistic Regression, SVM, BERT)
- Limitations tab: known accuracy ceiling, data domain mismatch, how to improve

**AI Insights modal** — full Claude output in a scrollable overlay

---

## Local setup

```bash
# 1. ML pipeline (only needed once; or download from Hugging Face on startup)
pip install -r backend/requirements.txt
python ml/01_normalise.py   # needs data/raw_transactions.csv
python ml/02_features.py
python ml/03_train.py
python ml/04_evaluate.py

# 2. Backend
cd backend
cp .env.example .env        # add ANTHROPIC_API_KEY and HF_REPO
uvicorn api.main:app --reload --port 8000

# 3. Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Environment variables (`.env`):

```
ANTHROPIC_API_KEY=sk-ant-...
HF_REPO=username/open-banking-classifier   # Hugging Face model repo
JWT_SECRET=change-me-in-production
```

Login with `test@test.com` / `password123`.

---

## Tradeoffs made

### Data source: government procurement over synthetic
The first attempt used a Kaggle fraud detection dataset with synthetic merchant names (`"Rippin Kub And Mann"`). TF-IDF found no signal. Switching to the US government credit card dataset (real merchant names) gave the model genuine vocabulary to learn from. The tradeoff: the model is trained on procurement spend, not consumer spend, so it has a ~65% ceiling on real banking data.

### RandomForest over neural models
Logistic Regression was tried first and performed worse. SVM is too slow on 506-dimensional sparse vectors. BERT fine-tuning would need 10K+ labelled consumer transactions to beat a RandomForest on this dataset. RandomForest worked out-of-the-box with balanced class weights and required no normalisation across its trees — practical for a portfolio project without GPU budget.

### Dropped "other" category
`other` was a catch-all for unmapped descriptions with no coherent merchant signal. Including it caused the model to confuse uncertain predictions across dining, shopping, and subscription. Dropping it raised F1 on every remaining category; unknown merchants fall back to keyword rules at inference time.

### Stratified 8K sample, not full 788K
The full dataset would take minutes to train and generate a 1GB+ feature matrix. An 8K stratified sample preserves category proportions and trains in ~30 seconds. Adding more data has diminishing returns when the bottleneck is data domain (procurement vs consumer), not sample size.

### Amounts are seeded-deterministic, not real
The CSV has real merchant names and categories but procurement dollar amounts (often $3 airline fees, $40K equipment). Each merchant gets a stable fake amount derived from an MD5 hash — so the same merchant always shows the same amount across page refreshes, making the demo look coherent without using real financial data.

### Z-score anomaly detection over ML-based
A simple population z-score (threshold 1.8σ) is transparent and requires no extra model. It works well enough for a demo. The tradeoff is that it flags statistically large transactions regardless of whether they are genuinely suspicious — a $400 flight looks like an anomaly in a mostly-small-spend dataset.

### Demo auth: no database
A single hardcoded user and in-memory JWT. No PostgreSQL, no hashing, no sessions. Every user sees the same ML-classified data. This is intentional — it keeps the demo self-contained and lets reviewers log in without signup friction. The comment in the code makes the tradeoff explicit.

### Claude with statistical fallback
The LLM layer uses Claude Sonnet for personalised, dollar-specific recommendations in Australian English. If the API key is missing or the call fails, a deterministic rule-based fallback generates recommendations from category percentages. This means the dashboard is always functional even without an Anthropic key.

### CORS allow-all origins
`allow_origins=["*"]` — fine for local dev and a portfolio demo but not production-safe.

---

## Known limitations

- **~65% accuracy ceiling** on real consumer data because the training set is US government procurement
- **No real per-user data** — all dashboard users see the same CSV-derived transactions
- **No database** — auth tokens are not stored; register creates a token but has no effect on subsequent logins
- **Static model** — there is no retraining trigger; accuracy drifts as merchant landscape changes
- **Healthcare F1 of 0.40** — not enough procurement healthcare rows to learn reliably
- **Search bar is UI-only** — the header search input is styled but not wired to the transaction filter state

---

## Future improvements

**ML accuracy**
- Replace or augment with labelled consumer transaction data (Plaid exports, open banking feeds) → realistic target of 85%+
- Fine-tune a BERT-based merchant embedding model to handle novel brand names that TF-IDF has never seen
- Retrain on a quarterly schedule to stay current with new merchants

**Anomaly detection**
- Replace z-score with Isolation Forest for multivariate anomaly detection (amount + category + merchant frequency + time-of-day)
- LSTM or transformer sequence model to flag unusual patterns across sessions, not just single large transactions

**User personalisation**
- Per-user transaction upload and storage
- User feedback loop: thumbs-up/down on category predictions → fine-tune the model per user
- Personalised Claude prompts that reference each user's historical spend patterns

**Infrastructure**
- PostgreSQL for auth, transaction storage, and per-user model feedback
- Redis for caching analysis results so repeated dashboard loads don't re-run the ML pipeline
- Continuous deployment pipeline: model retraining → evaluation → Hugging Face upload → zero-downtime rollout

**Product features**
- Wire up the header search bar to the transaction filter state
- Implement "Load older transactions" pagination
- Date range picker for the bar chart
- Budget goal setting with alerts when categories exceed thresholds
- Export transactions as CSV
- Real Open Banking API integration (Basiq for AU, Plaid for US) to replace the static CSV
- WebSocket activity log surfaced in the dashboard UI (the backend already streams it)
