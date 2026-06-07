"""
backend/api/main.py
===================
FastAPI ML service.

Endpoints:
  GET  /health                → system status
  POST /api/v1/classify       → classify a single transaction
  POST /api/v1/analyze        → classify + anomaly detect + insights
  GET  /api/v1/activity-log   → backend event log
  WS   /ws                    → real-time activity stream

Data flow:
  processed_transactions.csv
        ↓
  load_training_rows(limit)   ← reads real rows from CSV
        ↓
  classify_transaction()      ← trained RandomForest or keyword rules
        ↓
  detect_anomalies()          ← z-score statistical detection
        ↓
  generate_insights()         ← computed from real category totals
        ↓
  JSON response to Node backend
"""

import csv
import os
import pickle
import random
import hashlib
import asyncio
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, WebSocket
import jwt as pyjwt
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# Import Claude agent for AI-generated insights
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from agents.financial_agent import generate_claude_insights
from dotenv import load_dotenv
# ── paths ─────────────────────────────────────────────────────────────────────

BASE_DIR   = load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATA_PATH  = BASE_DIR / "data" / "processed_transactions.csv"
MODEL_PATH = BASE_DIR / "models" / "classifier.pkl"

# ── pydantic models ───────────────────────────────────────────────────────────

class Transaction(BaseModel):
    id:          str
    date:        str
    amount:      float
    merchant:    str
    description: str
    category:    Optional[str] = None
    confidence:  Optional[float] = None
    account_id:  str = "ACC_123"

class ClassificationRequest(BaseModel):
    merchant:    str
    description: str
    amount:      float

class ClassificationResponse(BaseModel):
    category:   str
    confidence: float
    method:     str

class AnomalyAlert(BaseModel):
    transaction_id: str
    merchant:       str
    anomaly_type:   str
    severity:       str
    description:    str
    amount:         float

class Metrics(BaseModel):
    total_spending:        float
    transaction_count:     int
    average_transaction:   float
    largest_transaction:   float
    largest_merchant:      str
    categories_count:      int
    ml_accuracy:           float
    classification_method: str

class Insights(BaseModel):
    summary:         str
    recommendations: List[str]
    confidence_note: str

class LoginRequest(BaseModel):
    email:    str
    password: str

class RegisterRequest(BaseModel):
    email:    str
    password: str
    name:     str

class AnalysisRequest(BaseModel):
    limit:             int  = 20
    include_insights:  bool = True
    include_anomalies: bool = True

class AnalysisResponse(BaseModel):
    status:        str
    timestamp:     str
    transactions:  List[Transaction]
    metrics:       Metrics
    anomalies:     List[AnomalyAlert]
    insights:      Insights
    processing_ms: float

# ── activity log ──────────────────────────────────────────────────────────────

class ActivityLog:
    def __init__(self, max_entries: int = 200):
        self._logs: List[dict] = []
        self._max = max_entries

    def add(self, status: str, message: str) -> None:
        ts = datetime.now().strftime("%H:%M:%S")
        self._logs.append({
            "id":        len(self._logs) + 1,
            "timestamp": ts,
            "status":    status,
            "message":   message,
        })
        if len(self._logs) > self._max:
            self._logs = self._logs[-self._max:]

    def recent(self, n: int = 50) -> List[dict]:
        return self._logs[-n:]

log = ActivityLog()

# ── ML model ──────────────────────────────────────────────────────────────────

_model_cache = None

def load_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            _model_cache = pickle.load(f)
        log.add("success", f"ML model loaded — RandomForest classifier ready")
        return _model_cache
    log.add("warning", "No trained model found — using keyword rules")
    return None
def download_from_hf():
    """Download model and data from Hugging Face if not present locally."""
    try:
        from huggingface_hub import hf_hub_download

        REPO = os.getenv("HF_REPO", "YOUR_USERNAME/open-banking-classifier")

        if not MODEL_PATH.exists():
            print("Downloading model from Hugging Face...")
            MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
            path = hf_hub_download(
                repo_id=REPO,
                filename="classifier.pkl",
                local_dir=str(MODEL_PATH.parent)
            )
            print(f"✓ Model downloaded to {path}")

        if not DATA_PATH.exists():
            print("Downloading data from Hugging Face...")
            DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
            path = hf_hub_download(
                repo_id=REPO,
                filename="processed_transactions.csv",
                local_dir=str(DATA_PATH.parent)
            )
            print(f"✓ Data downloaded to {path}")

    except Exception as e:
        print(f"HF download failed: {e}")
        print("Will use local files if available")

# ── keyword rules (fallback) ──────────────────────────────────────────────────

KEYWORD_RULES = {
    "groceries":     ["woolworths","coles","aldi","iga","harris farm","supermarket",
                      "grocery","whole foods","costco","sprouts","instacart","publix"],
    "dining":        ["restaurant","cafe","coffee","pizza","burger","sushi","bar","pub",
                      "nando","guzman","chipotle","mcdonald","subway","starbucks",
                      "saltwater","grounds","bill's beans","panera","five guys"],
    "utilities":     ["energy","electric","water","gas","internet","phone","telstra",
                      "optus","comcast","verizon","agl","origin","spectrum","at&t"],
    "transport":     ["uber","lyft","taxi","shell","chevron","fuel","parking","myki",
                      "airline","qantas","virgin","amtrak","transit","sydney trains"],
    "entertainment": ["netflix","spotify","disney","cinema","theater","concert",
                      "playstation","xbox","stan","binge","event cinemas","ticketek"],
    "shopping":      ["amazon","ebay","target","walmart","kmart","myer","david jones",
                      "jb hi-fi","harvey norman","big w","nordstrom","apple store"],
    "healthcare":    ["pharmacy","chemist","doctor","hospital","medical","dental",
                      "medibank","bupa","chemist warehouse","priceline","cvs"],
    "subscription":  ["subscription","monthly plan","adobe","microsoft","github",
                      "dropbox","canva","lastpass","apple music"],
}

def classify_by_keywords(merchant: str, description: str):
    text = f"{merchant} {description}".lower()
    for category, kws in KEYWORD_RULES.items():
        if any(kw in text for kw in kws):
            return category, 0.75
    return "other", 0.40

def classify_transaction(merchant: str, description: str) -> dict:
    model_data = load_model()
    if model_data:
        try:
            model = model_data["model"]
            vec   = model_data["vectorizer"]
            le    = model_data["label_encoder"]
            text  = f"{merchant} {description}".lower()
            X     = vec.transform([text])
            pred  = model.predict(X)[0]
            proba = model.predict_proba(X)[0]
            return {
                "category":   le.inverse_transform([pred])[0],
                "confidence": float(proba[pred]),
                "method":     "ml_model",
            }
        except Exception as e:
            log.add("warning", f"ML inference failed: {e} — falling back to keywords")

    category, conf = classify_by_keywords(merchant, description)
    return {"category": category, "confidence": conf, "method": "keyword_rules"}

# ── amount generator ──────────────────────────────────────────────────────────

AMOUNT_RANGES = {
    "groceries":     (20,  150),
    "dining":        (8,   80),
    "utilities":     (60,  180),
    "transport":     (5,   450),
    "entertainment": (10,  120),
    "shopping":      (15,  300),
    "healthcare":    (15,  200),
    "subscription":  (5,   30),
    "other":         (10,  100),
}

def stable_amount(merchant: str, category: str) -> float:
    seed = int(hashlib.md5(merchant.encode()).hexdigest(), 16) % 10_000
    rng  = random.Random(seed)
    lo, hi = AMOUNT_RANGES.get(category, (10, 100))
    return round(rng.uniform(lo, hi), 2)

# ── CSV loader ─────────────────────────────────────────────────────────────────

def load_training_rows(limit: int = 20) -> List[dict]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"processed_transactions.csv not found at {DATA_PATH}\n"
            f"Run: python ml/01_normalise.py && python ml/02_features.py"
        )
    rows = []
    with open(DATA_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= limit:
                break
            merchant    = row.get("merchant", "").strip()
            description = row.get("description", "").strip()
            true_cat    = row.get("category", "other").strip()
            if not merchant:
                continue
            amount   = stable_amount(merchant, true_cat)
            txn_date = (date.today() - timedelta(days=limit - i)).isoformat()
            rows.append({
                "id":            f"TXN_{i+1:03d}",
                "date":          txn_date,
                "merchant":      merchant,
                "description":   description,
                "amount":        amount,
                "account_id":    "ACC_123",
                "true_category": true_cat,
            })
    return rows

# ── anomaly detection ─────────────────────────────────────────────────────────

def detect_anomalies(transactions: List[Transaction]) -> List[AnomalyAlert]:
    if not transactions:
        return []
    amounts  = [t.amount for t in transactions]
    avg      = sum(amounts) / len(amounts)
    variance = sum((a - avg) ** 2 for a in amounts) / len(amounts)
    std      = variance ** 0.5
    alerts   = []
    for txn in transactions:
        z = (txn.amount - avg) / std if std > 0 else 0
        if z > 1.8:
            severity = "high" if z > 2.5 else "medium"
            alerts.append(AnomalyAlert(
                transaction_id = txn.id,
                merchant       = txn.merchant,
                anomaly_type   = "unusual_amount",
                severity       = severity,
                description    = (
                    f"${txn.amount:.2f} is {txn.amount/avg:.1f}x your average "
                    f"(${avg:.2f}). Z-score: {z:.1f}."
                ),
                amount = txn.amount,
            ))
            log.add("warning", f"Anomaly: {txn.merchant} ${txn.amount:.2f} (z={z:.1f})")
    log.add("success", f"Anomaly detection complete — {len(alerts)} flagged")
    return alerts

# ── insight generation ────────────────────────────────────────────────────────

def generate_insights(
    transactions: List[Transaction],
    anomalies:    List[AnomalyAlert],
    method:       str,
) -> Insights:
    total = sum(t.amount for t in transactions)
    count = len(transactions)
    avg   = total / count if count else 0

    cat_totals: dict = {}
    for t in transactions:
        cat = t.category or "other"
        cat_totals[cat] = cat_totals.get(cat, 0) + t.amount

    sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
    top3        = sorted_cats[:3]
    top3_lines  = "\n".join(
        f"  • {cat.capitalize()}: ${amt:.2f} ({amt/total*100:.1f}%)"
        for cat, amt in top3
    )

    top_cat = sorted_cats[0][0] if sorted_cats else "unknown"
    top_amt = sorted_cats[0][1] if sorted_cats else 0

    dining_total = cat_totals.get("dining", 0)
    sub_total    = cat_totals.get("subscription", 0)
    shop_total   = cat_totals.get("shopping", 0)

    summary = (
        f"Analysis of {count} transactions totalling ${total:.2f} "
        f"(avg ${avg:.2f}/transaction).\n\n"
        f"Top spending categories:\n{top3_lines}\n\n"
        f"Classification: {method}. Anomalies detected: {len(anomalies)}."
    )

    recs: List[str] = []
    if total > 0 and dining_total / total > 0.15:
        recs.append(
            f"Dining is {dining_total/total*100:.0f}% of spend (${dining_total:.2f}). "
            f"Meal prepping 2–3 nights/week could save $60–100/month."
        )
    if sub_total > 0:
        recs.append(
            f"Subscriptions total ${sub_total:.2f}. "
            f"Review quarterly and cancel unused services."
        )
    if total > 0 and shop_total / total > 0.18:
        recs.append(
            f"Shopping is {shop_total/total*100:.0f}% of spend (${shop_total:.2f}). "
            f"Try a 48-hour rule before non-essential purchases."
        )
    if len(anomalies) > 0:
        names = ", ".join(a.merchant for a in anomalies[:2])
        recs.append(
            f"{len(anomalies)} unusual transaction(s) flagged ({names}). "
            f"Verify these are expected."
        )
    if total > 0 and top_amt / total > 0.30:
        recs.append(
            f"{top_cat.capitalize()} dominates at {top_amt/total*100:.0f}% of spend. "
            f"Consider a monthly cap of ${top_amt * 0.85:.0f}."
        )
    if not recs:
        recs.append("Spending looks balanced — no immediate actions needed.")

    return Insights(
        summary         = summary,
        recommendations = recs,
        confidence_note = (
            f"Classified via {method}. "
            f"{'ML model active (~65% accuracy on govt data).' if method == 'ml_model' else 'Train model for higher accuracy: python ml/03_train.py'}"
        ),
    )

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="Open Banking ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    log.add("success", "Python ML service started")
    load_model()
    if DATA_PATH.exists():
        with open(DATA_PATH) as f:
            n = sum(1 for _ in f) - 1
        log.add("success", f"Data ready — {n:,} rows in processed_transactions.csv")
    else:
        log.add("error", f"processed_transactions.csv not found at {DATA_PATH}")

# ── routes ────────────────────────────────────────────────────────────────────

# ── Simple demo auth ─────────────────────────────────────────────────────────
# No database needed — single demo user for portfolio purposes
DEMO_USERS = {
    "test@test.com": {"password": "password123", "name": "Demo User", "id": "demo_001"}
}
JWT_SECRET = os.getenv("JWT_SECRET", "demo_secret_key_change_in_production")

@app.post("/auth/login")
async def login(req: LoginRequest):
    user = DEMO_USERS.get(req.email)
    if not user or user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = pyjwt.encode(
        {"sub": user["id"], "email": req.email},
        JWT_SECRET, algorithm="HS256"
    )
    return {
        "message": "Login successful",
        "token": token,
        "user": {"id": user["id"], "email": req.email, "name": user["name"]}
    }

@app.post("/auth/register")
async def register(req: RegisterRequest):
    # In demo mode, register just returns a token — no persistence
    token = pyjwt.encode(
        {"sub": req.email, "email": req.email},
        JWT_SECRET, algorithm="HS256"
    )
    return {
        "message": "Account created",
        "token": token,
        "user": {"id": req.email, "email": req.email, "name": req.name}
    }

@app.get("/auth/me")
async def me():
    return {"id": "demo_001", "email": "test@test.com", "name": "Demo User"}

@app.get("/health")
async def health():
    return {
        "status":    "healthy",
        "ml_model":  "trained" if MODEL_PATH.exists() else "not trained (keyword rules)",
        "data_file": DATA_PATH.exists(),
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/v1/classify", response_model=ClassificationResponse)
async def classify(req: ClassificationRequest):
    result = classify_transaction(req.merchant, req.description)
    log.add("success", f"{req.merchant} → {result['category']} ({result['confidence']*100:.0f}%)")
    return ClassificationResponse(**result)


@app.post("/api/v1/analyze", response_model=AnalysisResponse)
async def analyze(req: AnalysisRequest):
    t0 = datetime.now()

    log.add("info", f"Loading {req.limit} rows from processed_transactions.csv")
    try:
        raw_rows = load_training_rows(req.limit)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    log.add("success", f"Loaded {len(raw_rows)} rows")
    log.add("processing", f"Classifying {len(raw_rows)} transactions…")

    classified: List[Transaction] = []
    correct = 0
    method  = "ml_model" if load_model() else "keyword_rules"

    for row in raw_rows:
        result = classify_transaction(row["merchant"], row["description"])
        if result["category"] == row["true_category"]:
            correct += 1
        log.add(
            "success",
            f"{row['merchant']} → {result['category']} "
            f"({result['confidence']*100:.0f}% · {result['method']})",
        )
        classified.append(Transaction(
            id          = row["id"],
            date        = row["date"],
            merchant    = row["merchant"],
            description = row["description"],
            amount      = row["amount"],
            category    = result["category"],
            confidence  = result["confidence"],
            account_id  = row["account_id"],
        ))

    accuracy = correct / len(raw_rows) if raw_rows else 0.0
    log.add("success", f"Classification done — {correct}/{len(raw_rows)} match ground truth ({accuracy*100:.0f}%)")

    anomalies: List[AnomalyAlert] = []
    if req.include_anomalies:
        log.add("processing", "Running anomaly detection…")
        anomalies = detect_anomalies(classified)

    total   = sum(t.amount for t in classified)
    avg_amt = total / len(classified) if classified else 0
    largest = max(classified, key=lambda t: t.amount) if classified else None

    metrics = Metrics(
        total_spending        = round(total, 2),
        transaction_count     = len(classified),
        average_transaction   = round(avg_amt, 2),
        largest_transaction   = round(largest.amount if largest else 0, 2),
        largest_merchant      = largest.merchant if largest else "",
        categories_count      = len({t.category for t in classified if t.category}),
        ml_accuracy           = round(accuracy, 4),
        classification_method = method,
    )

    insights = Insights(summary="", recommendations=[], confidence_note="")
    if req.include_insights:
        log.add("processing", "Claude agent generating insights…")
        # Try Claude first, fall back to statistical insights
        try:
            txn_dicts = [
                {"category": t.category, "amount": t.amount, "merchant": t.merchant}
                for t in classified
            ]
            metrics_dict = {
                "total_spending":        metrics.total_spending,
                "transaction_count":     metrics.transaction_count,
                "average_transaction":   metrics.average_transaction,
                "largest_transaction":   metrics.largest_transaction,
                "largest_merchant":      metrics.largest_merchant,
                "ml_accuracy":           metrics.ml_accuracy,
                "classification_method": metrics.classification_method,
            }
            anomaly_dicts = [
                {"merchant": a.merchant, "amount": a.amount, "description": a.description}
                for a in anomalies
            ]
            claude_result = generate_claude_insights(txn_dicts, metrics_dict, anomaly_dicts)
            insights = Insights(
                summary         = claude_result["summary"],
                recommendations = claude_result["recommendations"],
                confidence_note = claude_result["confidence_note"],
            )
            log.add("success", "Claude agent insights generated")
        except Exception as e:
            log.add("warning", f"Claude failed ({e}) — using statistical insights")
            insights = generate_insights(classified, anomalies, method)
        log.add("success", f"Insights ready — {len(insights.recommendations)} recommendations")

    ms = (datetime.now() - t0).total_seconds() * 1000
    log.add("success", f"Analysis complete in {ms:.0f}ms")

    return AnalysisResponse(
        status        = "success",
        timestamp     = datetime.now().isoformat(),
        transactions  = classified,
        metrics       = metrics,
        anomalies     = anomalies,
        insights      = insights,
        processing_ms = round(ms, 1),
    )


@app.get("/api/v1/activity-log")
async def activity_log_endpoint(limit: int = 50):
    return {"logs": log.recent(limit), "total": len(log._logs)}


@app.get("/api/v1/stats")
async def stats():
    model_data = load_model()
    return {
        "ml_model": {
            "trained":    model_data is not None,
            "path":       str(MODEL_PATH),
            "categories": list(model_data["label_encoder"].classes_) if model_data else [],
        },
        "data": {
            "csv_exists": DATA_PATH.exists(),
            "path":       str(DATA_PATH),
        },
    }


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    log.add("info", "Dashboard connected via WebSocket")
    try:
        while True:
            await asyncio.sleep(2)
            await ws.send_json({"type": "activity", "logs": log.recent(10)})
    except Exception:
        pass


@app.get("/api/v1/eval-report")
async def eval_report():
    """
    Returns the JSON evaluation report produced by ml/04_evaluate.py.
    Used by the ML Insights panel in the dashboard to show live F1 scores.
    Run 04_evaluate.py to regenerate after retraining.
    """
    import json
    path = BASE_DIR / "models" / "eval_report.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="eval_report.json not found. Run: python ml/04_evaluate.py"
        )
    with open(path) as f:
        return json.load(f)
@app.on_event("startup")
async def startup():
    download_from_hf()
    log.add("success", "Python ML service started")
    load_model()
@app.get("/")
async def root():
    return {"name": "Open Banking ML Service", "docs": "/docs"}