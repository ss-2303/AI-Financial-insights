"""
backend/agents/financial_agent.py
==================================
Claude LLM agent for financial insights.
Compatible with anthropic >= 0.100.0
"""

import os
import json
import re
from typing import List
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


def generate_claude_insights(transactions: list, metrics: dict, anomalies: list) -> dict:
    """Generate personalised insights using Claude."""

    # Import here to avoid module-level init issues
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_anthropic_key_here":
        return _fallback(metrics, "API key not set")

    try:
        cat_totals: dict = {}
        for t in transactions:
            cat = t.get("category", "other")
            cat_totals[cat] = cat_totals.get(cat, 0) + t.get("amount", 0)

        total = metrics.get("total_spending", 0)
        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
        breakdown = "\n".join(
            f"  {cat}: ${amt:.2f} ({amt/total*100:.1f}%)"
            for cat, amt in sorted_cats if total > 0
        )

        anomaly_text = ""
        if anomalies:
            anomaly_text = "\nAnomalies:\n" + "\n".join(
                f"  - {a.get('merchant')} ${a.get('amount', 0):.2f}"
                for a in anomalies[:3]
            )

        prompt = f"""You are a personal finance advisor for an Australian banking app.

SPENDING DATA:
- Transactions: {metrics.get('transaction_count')}
- Total: ${total:.2f}
- Average: ${metrics.get('average_transaction', 0):.2f}
- Largest: ${metrics.get('largest_transaction', 0):.2f} at {metrics.get('largest_merchant', '')}

BY CATEGORY:
{breakdown}
{anomaly_text}

Return JSON only:
{{
  "summary": "3-4 sentences about spending patterns with specific amounts",
  "recommendations": ["specific tip 1", "specific tip 2", "specific tip 3"],
  "confidence_note": "one sentence about data quality"
}}

Use Australian language. Reference actual dollar amounts."""

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            result = json.loads(match.group())
            return {
                "summary":         result.get("summary", ""),
                "recommendations": result.get("recommendations", []),
                "confidence_note": result.get("confidence_note", ""),
            }

    except Exception as e:
        return _fallback(metrics, str(e)[:80])

    return _fallback(metrics, "Parse error")


def _fallback(metrics: dict, reason: str) -> dict:
    total = metrics.get("total_spending", 0)
    count = metrics.get("transaction_count", 0)
    return {
        "summary": f"Analysis of {count} transactions totalling ${total:.2f}.",
        "recommendations": [
            "Set up automatic savings transfers.",
            "Review subscription services quarterly.",
            "Track your largest spending category each fortnight."
        ],
        "confidence_note": f"Statistical insights (Claude unavailable: {reason[:60]})",
    }