"""Generate a clearly labeled, deterministic 3-year sample transaction CSV."""

import csv
import random
from datetime import date, datetime, time, timedelta
from pathlib import Path


SEED = 20261021
ROW_COUNT = 20_949
START_DATE = date(2023, 10, 21)
END_DATE = date(2026, 10, 21)
OUTPUT = Path(__file__).resolve().parents[1] / "database" / "transactions_3_years_synthetic.csv"

BRANCHES = [
    "Happy Skin Cavite Branch",
    "Happy Skin Lipa Branch",
    "Happy Skin Main Branch",
]

# Current menu and prices from the project's service seed file. Historical prices
# are intentionally omitted because no verified historical price list was provided.
SERVICES = [
    ("Hair Rebonding", 1500), ("Keratin Treatment", 1500), ("Hair Botox", 1800),
    ("Scalp Treatment", 799), ("Body Scrub", 799), ("Body Massage", 699),
    ("Foot Massage", 399), ("Body Slimming", 1200), ("Body Contouring", 1200),
    ("Face / Chin", 2000), ("Arms", 3500), ("Tummy", 4500),
    ("Face + Arms + Tummy", 8500), ("Body Whitening", 1500),
    ("Basic Manicure", 299), ("Gel Manicure", 499), ("Basic Pedicure", 499),
    ("Gel Pedicure", 599), ("Foot Spa", 250), ("Acrylic Nails", 1200),
    ("Gel Extension", 1000), ("Nail Art", 250), ("Nail Removal", 100),
    ("Nail Repair", 100), ("Lash Lift", 599), ("Classic Lash Extension", 999),
    ("Hybrid Lash Extension", 1299), ("Volume Lash Extension", 1499),
    ("Brow Shaping", 199), ("Brow Tint", 299), ("Brow Lamination", 699),
    ("Haircut", 250), ("Hair Spa", 699), ("Hair Treatment", 599),
    ("Hair Coloring", 1200), ("Basic Facial", 499), ("Deep Cleansing Facial", 599),
    ("Acne Facial", 799), ("Brightening Facial", 699), ("Anti-Aging Facial", 899),
    ("Hydrating Facial", 699), ("Signature Facial", 699), ("HydraFacial", 899),
    ("Diamond Peel", 599), ("LED Light Therapy", 399), ("RF Facial", 799),
    ("RF Body Contouring", 1200), ("Cavitation", 1200), ("HIFU Facial", 2500),
    ("Skin Booster", 2500), ("Microneedling", 1800),
    ("Underarm Whitening", 699), ("Bikini Whitening", 999),
]


def main() -> None:
    rng = random.Random(SEED)
    span = (END_DATE - START_DATE).days
    dates = [START_DATE, END_DATE]
    dates.extend(START_DATE + timedelta(days=rng.randrange(1, span)) for _ in range(ROW_COUNT - 2))
    dates.sort()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    columns = [
        "transaction_id", "booking_id", "transaction_datetime", "branch_name",
        "client_name", "service_name", "service_provider", "encoded_by",
        "payment_method", "subtotal_php", "discount_php", "sale_php",
        "commission_rate_percent", "commission_php", "status", "data_origin",
    ]
    with OUTPUT.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=columns)
        writer.writeheader()
        for index, day in enumerate(dates, start=1):
            hour = rng.choices(range(10, 21), weights=[1, 2, 3, 4, 4, 4, 4, 4, 3, 2, 1])[0]
            minute = rng.randrange(60)
            second = rng.randrange(60)
            service, price = rng.choice(SERVICES)
            # Mark generated amounts as estimates; do not represent them as salon records.
            subtotal = price
            discount = rng.choices([0, round(price * 0.05), round(price * 0.10)], [78, 17, 5])[0]
            sale = subtotal - discount
            commission_rate = rng.choice([0, 5, 8, 10])
            commission = round(sale * commission_rate / 100, 2)
            writer.writerow({
                "transaction_id": f"SYN-TXN-{index:06d}",
                "booking_id": f"SYN-BOOK-{index:06d}",
                "transaction_datetime": datetime.combine(day, time(hour, minute, second)).isoformat(sep=" "),
                "branch_name": rng.choices(BRANCHES, [0.30, 0.30, 0.40])[0],
                "client_name": f"Synthetic Customer {index:06d}",
                "service_name": service,
                "service_provider": f"Synthetic Provider {rng.randint(1, 12):02d}",
                "encoded_by": f"Synthetic Staff {rng.randint(1, 9):02d}",
                "payment_method": rng.choices(["Cash", "GCash", "Maya", "Card"], [45, 35, 12, 8])[0],
                "subtotal_php": f"{subtotal:.2f}",
                "discount_php": f"{discount:.2f}",
                "sale_php": f"{sale:.2f}",
                "commission_rate_percent": f"{commission_rate:.2f}",
                "commission_php": f"{commission:.2f}",
                "status": "Completed",
                "data_origin": "SYNTHETIC_SAMPLE_NOT_REAL_TRANSACTION",
            })

    print(f"Created {ROW_COUNT:,} synthetic transaction rows: {START_DATE} through {END_DATE}")
    print(OUTPUT)


if __name__ == "__main__":
    main()
