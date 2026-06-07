"""
ml/01_normalise.py
==================
Phase 1, Step 1 — Normalise government credit card transaction data.

Input:   data/raw_transactions.csv   (US Govt credit card dataset, 788K rows)
Output:  data/processed_transactions.csv

Column mapping:
  Merchant        → merchant   (real names like "USPS", "DELTA AIR", "AMAZON")
  TranxDescription→ category   (255 descriptions → mapped to our 9 categories)
  TranxDate       → date       (mixed formats: 06/29/2018 and 07-03-2018)
  TrnxAmount      → amount
  Department      → department (keep for context)
  Division        → division   (keep for context)

Why this dataset works where Kaggle fraud detection didn't:
  - Real merchant names (USPS, DELTA AIR, AMAZON) → TF-IDF has genuine signal
  - 788K rows → plenty to stratified sample from
  - 255 description values → maps cleanly to our 9-category taxonomy
"""

import pandas as pd
import re
from pathlib import Path

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "data" / "CreditCardTransaction.csv"
OUT_PATH = ROOT / "data" / "processed_transactions.csv"

# ── category mapping ───────────────────────────────────────────────────────────
# Maps 255 TranxDescription values → our 9-category taxonomy.
# Built from inspecting the top 30 most common descriptions.
# Anything not listed falls through to "other".
CATEGORY_MAP = {
    # groceries
    "Grocery Stores Supermarkets":                          "groceries",
    "Food Stores-Not Elsewhere Classified":                 "groceries",

    # dining
    "Eating Places Restaurants":                            "dining",
    "Fast Food Restaurants":                                "dining",
    "Drinking Places":                                      "dining",
    "Caterers":                                             "dining",
    "Restaurants":                                          "dining",

    # transport
    "Airline":                                              "transport",
    "Travel":                                               "transport",
    "Automobile Parking Lots And Garages":                  "transport",
    "Automotive Parts Accessories Stores":                  "transport",
    "Automotive Service Shops":                             "transport",
    "Toll And Bridge Fees":                                 "transport",
    "Truck Stop":                                           "transport",
    "Railroads":                                            "transport",
    "Bus Lines":                                            "transport",
    "Taxicabs And Limousines":                              "transport",
    "Cruise Lines":                                         "transport",
    "Car Rental Agencies":                                  "transport",
    "Service Stations":                                     "transport",
    "Fuel Dealers-Not Elsewhere Classified":                "transport",

    # utilities
    "Utlts-Elctrc Gas Heating Oil Sanitary Water":          "utilities",
    "Telecom Incl Prepaid-Recurring Phone Svcs":            "utilities",
    "Cable Satellite Other Pay Television Radio Svcs":      "utilities",
    "Telephone Communications-Not Elsewhere Classified":    "utilities",
    "Utilities-Not Elsewhere Classified":                   "utilities",
    "Postal Services-Government Only":                      "utilities",
    "Courier Services-Air And Ground":                      "utilities",

    # shopping
    "Book Stores":                                          "shopping",
    "Stationery-Office Supplies-Printing Writing Pap":      "shopping",
    "Home Supply Warehouse Stores":                         "shopping",
    "Discount Stores":                                      "shopping",
    "Miscellaneous And Specialty Retail Stores":            "shopping",
    "Electronic Sales":                                     "shopping",
    "Computers Computer Peripheral Equipment Software":     "shopping",
    "Computer Software Stores":                             "shopping",
    "Hardware Stores":                                      "shopping",
    "Industrial Supplies Not Elsewhere Classified":         "shopping",
    "Commercial Equipment Not Elsewhere Classified":        "shopping",
    "Durable Goods Not Elsewhere Classified":               "shopping",
    "Nondurable Goods Not Elsewhere Classified":            "shopping",
    "Uniforms Commercial Clothing":                         "shopping",
    "Clothing Stores-Not Elsewhere Classified":             "shopping",
    "Department Stores":                                    "shopping",
    "Wholesale Clubs":                                      "shopping",
    "Drug Stores And Pharmacies":                           "shopping",
    "Variety Stores":                                       "shopping",
    "Sporting Goods Stores":                                "shopping",
    "Office And Commercial Furniture":                      "shopping",
    "Gift Card Novelty And Souvenir Shops":                 "shopping",
    "Hobby Toy And Game Shops":                             "shopping",
    "Shoe Stores":                                          "shopping",
    "Jewelry Stores-Watches Clocks And Silverware Stores":  "shopping",
    "Office Supplies And Stationery Stores":                "shopping",
    "Pet Shops-Pet Food And Supplies":                      "shopping",

    # healthcare
    "Medical Services And Health Practitioners":            "healthcare",
    "Hospitals":                                            "healthcare",
    "Dental And Orthodontic Services":                      "healthcare",
    "Opticians And Eyeglass Establishments":                "healthcare",
    "Health And Beauty Spas":                               "healthcare",
    "Chiropractors":                                        "healthcare",
    "Nursing Dental Personal Care Facilities":              "healthcare",
    "Medical Laboratory And Dental X-Ray Labs":             "healthcare",

    # entertainment
    "Lodging":                                              "entertainment",
    "Hotels Motels Inns Resorts":                           "entertainment",
    "Direct Marketing-Continuity-Subscription Merchants":   "entertainment",
    "Amusement Parks Carnivals Circuses":                   "entertainment",
    "Movie Theaters":                                       "entertainment",
    "Membership Clubs Sports-Recreation-Athletic":          "entertainment",
    "Recreation Services Not Elsewhere Classified":         "entertainment",
    "Bowling Alleys":                                       "entertainment",
    "Golf Courses-Public":                                  "entertainment",
    "Tourist Attractions And Exhibits":                     "entertainment",

    # subscription
    "Business Services-Not Elsewhere Classified":           "subscription",
    "Government Services-Not Elsewhere Classified":         "subscription",
    "Organizations Charitable And Social Services":         "subscription",
    "Organizations Membership-Not Elsewhere Classified":    "subscription",
    "Schools Educational Svc-Not Elsewhere Classified":     "subscription",
    "Cleaning And Maintenance Janitorial Services":         "subscription",
    "Professional Services Not Elsewhere Classified":       "subscription",
    "Computer Programming Data Processing":                 "subscription",
    "Consulting Management And Public Relations Services":  "subscription",
    "Insurance Sales Underwriting Premium":                 "subscription",
    "Advertising Services":                                 "subscription",
    "Legal Services-Attorneys":                             "subscription",
    "Accounting-Auditing-Bookkeeping Services":             "subscription",
    "Equipment Rental And Leasing":                         "subscription",
    "Laundry Cleaning And Garment Services":                "subscription",
    "Miscellaneous Business Services":                      "subscription",
    "Professional Services-Not Elsewhere Classified":       "subscription",
    "Colleges Univ Pro Schools Junior Colleges":            "subscription",
    "Direct Marketing-Other Direct Marketers-Not Elsew":    "subscription",
    "Direct Marketing-Combination Catalog-Retail Merch":    "subscription",
    "Direct Marketing-Catalog Merchants":                   "subscription",
    "Miscellaneous Publishing And Printing":                "subscription",
    "Internal Transaction":                                 "subscription",

    # healthcare — previously unmapped, causing "other" pollution
    "Dental-Lab-Med-Ophthalmic Hosp Equip Supplies":        "healthcare",
    "Medical-Dental Labs Opticians":                        "healthcare",

    # shopping — previously unmapped
    "Electrical Parts And Equipment":                       "shopping",
    "Plumbing And Heating Equipment":                       "shopping",
    "Construction Materials Not Elsewhere Classified":      "shopping",
    "Office School Supply And Stationery Stores":           "shopping",
    "Miscellaneous General Merchandise":                    "shopping",
    "Mens-Womens-Childrens Uniforms-Commercial Cloth":      "shopping",
    "Glass Paint Wallpaper Stores":                         "shopping",
    "Misc-Auto-Aircraft-Farm Equip Not Elsewhere Class":    "shopping",
    "Auto And Home Supply Stores":                          "shopping",

    # transport — previously unmapped
    "Auto Truck Dlrs-Sales Svc Reprs Prts Leasing":         "transport",
    "Service Stations With Or Without Ancillary Service":   "transport",
    "Courier Svc-Air Ground Freight Forwarders":            "transport",

    # dining — previously unmapped
    "Misc Food Store-Convenience Mrkt Splty Vendng Macs":   "dining",
}


def clean_merchant(name: str) -> str:
    """
    Aggressive merchant name cleaning for government card data.
    Examples:
      'STAPLS0175689368000002'  → 'staples'
      'AMZN MKTP US*1A2B3C'    → 'amazon'
      'DELTA AIR 00623571149'   → 'delta air'
      'USPS PO 0917600901'      → 'usps'
      'SQ *COFFEE SHOP'         → 'coffee shop'
      'LOWES #01234'            → 'lowes'
      'MARRIOTT HOTELS INC'     → 'marriott hotels'

    Steps:
      1. Known brand normalisation (amzn → amazon, stapls → staples)
      2. Remove payment processor prefixes
      3. Remove ALL digit sequences
      4. Remove special characters and noise words
      5. Lowercase, strip, collapse spaces
    """
    name = str(name).upper()

    # 1. Normalise known truncated brand names BEFORE any other cleaning
    brand_fixes = {
        r"STAPLS\w*":      "STAPLES",
        r"AMZN\s*MKTP":    "AMAZON",
        r"AMZN":            "AMAZON",
        r"WM\s*SUPERCENTER":"WALMART",
        r"WAL-MART":        "WALMART",
        r"WHOLEFDS":        "WHOLE FOODS",
        r"STARBUCKS\s*\#\d*": "STARBUCKS",
        r"LOWES\s*\#\d*":     "LOWES",
        r"HOME\s*DEPOT":   "HOME DEPOT",
        r"BEST\s*BUY\s*\#\d*": "BEST BUY",
        r"DELTA\s*AIR":    "DELTA AIRLINES",
        r"UNITED\s*AIR":   "UNITED AIRLINES",
        r"AMERICAN\s*AIR": "AMERICAN AIRLINES",
        r"SOUTHWEST\s*AIR":"SOUTHWEST AIRLINES",
        r"MARRIOTT":        "MARRIOTT",
        r"HILTON":          "HILTON",
        r"HYATT":           "HYATT",
        r"VZWRLSS\w*":     "VERIZON",
        r"VERIZONWRLSS\w*":"VERIZON",
        r"VZWRLSS":         "VERIZON",
        r"ATT\s*\*":      "ATT",
        r"TMOBILE\w*":     "TMOBILE",
        r"UPS\s*STORE":    "UPS STORE",
        r"FEDEX":           "FEDEX",
        r"GRAINGER":        "GRAINGER",
        r"OFFICE\s*DEPOT": "OFFICE DEPOT",
        r"OFFICEMAX":       "OFFICE DEPOT",
        r"COSTCO":          "COSTCO",
        r"TARGET\s*\#\d*": "TARGET",
    }
    for pattern, replacement in brand_fixes.items():
        name = re.sub(pattern, replacement, name)

    # 2. Remove payment processor prefixes
    name = re.sub(r"^(SQ \*|TST\*\s*|SP \*|PP \*|PAYPAL\s*\*|AUT\s+)", "", name)

    # 3. Remove everything after * (order reference codes)
    name = re.sub(r"\*.*$", "", name)

    # 4. Remove ALL digit sequences and store numbers
    name = re.sub(r"\b\d+\b", "", name)
    name = re.sub(r"#\d*", "", name)

    # 5. Remove special characters
    name = re.sub(r"[^A-Z\s]", " ", name)

    # 6. Lowercase, strip, collapse spaces
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)

    return name if name else "unknown"


def parse_date(date_str: str) -> str:
    """
    Two date formats exist in this dataset:
      06/29/2018  (MM/DD/YYYY)
      07-03-2018  (MM-DD-YYYY)
    Normalise both to YYYY-MM-DD.
    """
    date_str = str(date_str).strip().replace("-", "/")
    try:
        return pd.to_datetime(date_str, format="%m/%d/%Y").strftime("%Y-%m-%d")
    except Exception:
        return pd.to_datetime(date_str, infer_datetime_format=True).strftime("%Y-%m-%d")


def normalise(df: pd.DataFrame) -> pd.DataFrame:
    print(f"\n{'─'*55}")
    print(f"  RAW DATA SUMMARY")
    print(f"{'─'*55}")
    print(f"  Rows:             {len(df):,}")
    print(f"  Columns:          {list(df.columns)}")
    print(f"  Unique merchants: {df['Merchant'].nunique():,}")
    print(f"  Unique descs:     {df['TranxDescription'].nunique():,}")
    print(f"  Amount range:     ${df['TrnxAmount'].min():.2f} – ${df['TrnxAmount'].max():.2f}")
    print(f"{'─'*55}\n")

    # 1. Keep only needed columns
    df = df[["Merchant", "TranxDescription", "TranxDate",
             "TrnxAmount", "Department", "Division"]].copy()

    # 2. Rename to standard names
    df = df.rename(columns={
        "Merchant":         "merchant",
        "TranxDescription": "description",
        "TranxDate":        "date",
        "TrnxAmount":       "amount",
        "Department":       "department",
        "Division":         "division",
    })

    # 3. Map description → category
    print("  Mapping TranxDescription → category...")
    df["category"] = df["description"].str.strip().map(CATEGORY_MAP)
    unmapped       = df["category"].isna()
    n_unmapped     = unmapped.sum()
    pct            = n_unmapped / len(df) * 100
    print(f"  Unmapped: {n_unmapped:,} rows ({pct:.1f}%) → 'other'")
    print(f"  Top unmapped descriptions:")
    for desc, count in df[unmapped]["description"].value_counts().head(6).items():
        print(f"    {count:>6,}  {desc}")
    df["category"] = df["category"].fillna("other")

    # 4. Clean merchant names
    print(f"\n  Cleaning merchant names...")
    print(f"    Before: '{df['merchant'].iloc[0]}'")
    df["merchant"] = df["merchant"].apply(clean_merchant)
    print(f"    After:  '{df['merchant'].iloc[0]}'")

    # 5. Parse dates
    print(f"\n  Parsing dates...")
    df["date"] = df["date"].apply(parse_date)

    # 6. Remove refunds (negative) and zero amounts
    before     = len(df)
    df         = df[df["amount"] > 0]
    print(f"\n  Removed {before - len(df):,} zero/negative amount rows")

    # 7. Round amount to 2 decimal places
    df["amount"] = df["amount"].round(2)

    # 8. Clean department / division text
    df["department"] = df["department"].str.strip().str.title()
    df["division"]   = df["division"].str.strip().str.title()

    # 9. Drop rows missing critical values
    before = len(df)
    df     = df.dropna(subset=["merchant", "amount", "category", "date"])
    print(f"  Dropped {before - len(df):,} rows with missing values")

    # 10. Drop duplicates on merchant + date + amount
    before = len(df)
    df     = df.drop_duplicates(subset=["merchant", "date", "amount"])
    print(f"  Removed {before - len(df):,} duplicate rows")

    return df.reset_index(drop=True)


def print_summary(df: pd.DataFrame) -> None:
    print(f"\n{'─'*55}")
    print(f"  PROCESSED DATA SUMMARY")
    print(f"{'─'*55}")
    print(f"  Rows:    {len(df):,}")
    print(f"  Columns: {list(df.columns)}")

    print(f"\n  Category distribution:")
    for cat, n in df["category"].value_counts().items():
        bar = "█" * int(n / len(df) * 40)
        pct = n / len(df) * 100
        print(f"    {cat:<15}  {n:>7,}  {pct:>5.1f}%  {bar}")

    print(f"\n  Amount stats:")
    print(f"    Min:    ${df['amount'].min():.2f}")
    print(f"    Max:    ${df['amount'].max():.2f}")
    print(f"    Mean:   ${df['amount'].mean():.2f}")
    print(f"    Median: ${df['amount'].median():.2f}")

    print(f"\n  Sample rows:")
    print(df[["date","merchant","category","amount"]].head(8).to_string(index=False))
    print(f"{'─'*55}\n")


def main():
    if not RAW_PATH.exists():
        print(f"\n  ERROR: {RAW_PATH} not found.")
        print(f"  Place your Kaggle CSV at: data/raw_transactions.csv\n")
        return

    print(f"\n  Reading {RAW_PATH.name}...")
    df = pd.read_csv(RAW_PATH, low_memory=False)

    df_clean = normalise(df)
    print_summary(df_clean)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df_clean.to_csv(OUT_PATH, index=False)
    print(f"  Saved → {OUT_PATH}")
    print(f"  Next step: python ml/02_features.py\n")


if __name__ == "__main__":
    main()