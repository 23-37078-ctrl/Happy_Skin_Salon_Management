import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.branch import Branch
from app.models.service import Service

# Current Happy Skin service menu and prices (2026).
# Durations are operational estimates; the printed menu only specifies prices.
CATALOG = [
    ("Hair Rebonding", 1500, 180), ("Keratin Treatment", 1500, 150),
    ("Hair Botox", 1800, 150), ("Scalp Treatment", 799, 60),
    ("Body Scrub", 799, 60), ("Body Massage", 699, 60),
    ("Foot Massage", 399, 30), ("Body Slimming", 1200, 60),
    ("Body Contouring", 1200, 60), ("Face / Chin", 2000, 45),
    ("Arms", 3500, 60), ("Tummy", 4500, 60),
    ("Face + Arms + Tummy", 8500, 90), ("Body Whitening", 1500, 60),
    ("Basic Manicure", 299, 40), ("Gel Manicure", 499, 60),
    ("Basic Pedicure", 499, 50), ("Gel Pedicure", 599, 60),
    ("Foot Spa", 250, 30), ("Acrylic Nails", 1200, 90),
    ("Gel Extension", 1000, 90), ("Nail Art", 250, 30),
    ("Nail Removal", 100, 20), ("Nail Repair", 100, 20),
    ("Lash Lift", 599, 60), ("Classic Lash Extension", 999, 90),
    ("Hybrid Lash Extension", 1299, 120), ("Volume Lash Extension", 1499, 150),
    ("Brow Shaping", 199, 20), ("Brow Tint", 299, 30),
    ("Brow Lamination", 699, 60), ("Haircut", 250, 45),
    ("Hair Spa", 699, 60), ("Hair Treatment", 599, 60),
    ("Hair Coloring", 1200, 120), ("Basic Facial", 499, 60),
    ("Deep Cleansing Facial", 599, 75), ("Acne Facial", 799, 75),
    ("Brightening Facial", 699, 60), ("Anti-Aging Facial", 899, 75),
    ("Hydrating Facial", 699, 60), ("Signature Facial", 699, 60),
    ("HydraFacial", 899, 75), ("Diamond Peel", 599, 60),
    ("LED Light Therapy", 399, 30), ("RF Facial", 799, 45),
    ("RF Body Contouring", 1200, 60), ("Cavitation", 1200, 60),
    ("HIFU Facial", 2500, 60), ("Skin Booster", 2500, 60),
    ("Microneedling", 1800, 60), ("Underarm Whitening", 699, 45),
    ("Bikini Whitening", 999, 45),
]

SERVICE_IMAGES = {
    "Hair Rebonding": "hair-rebond", "Keratin Treatment": "hair-rebond",
    "Hair Botox": "hair-spa-treatment", "Scalp Treatment": "hair-spa-treatment",
    "Body Scrub": "swedish-body-massage", "Body Massage": "swedish-body-massage",
    "Foot Massage": "foot-spa-massage", "Body Slimming": "swedish-body-massage",
    "Body Contouring": "swedish-body-massage", "Face / Chin": "pico-whitening-laser",
    "Arms": "underarm-whitening", "Tummy": "underarm-whitening",
    "Face + Arms + Tummy": "underarm-whitening", "Body Whitening": "underarm-whitening",
    "Basic Manicure": "gel-manicure", "Gel Manicure": "gel-manicure",
    "Basic Pedicure": "classic-pedicure", "Gel Pedicure": "classic-pedicure",
    "Foot Spa": "foot-spa-massage", "Acrylic Nails": "gel-manicure",
    "Gel Extension": "gel-manicure", "Nail Art": "gel-manicure",
    "Nail Removal": "gel-manicure", "Nail Repair": "gel-manicure",
    "Lash Lift": "lash-lift-tint", "Classic Lash Extension": "classic-eyelash-extension",
    "Hybrid Lash Extension": "classic-eyelash-extension", "Volume Lash Extension": "classic-eyelash-extension",
    "Brow Shaping": "brow-care", "Brow Tint": "brow-care", "Brow Lamination": "brow-care",
    "Haircut": "hair-rebond", "Hair Spa": "hair-spa-treatment",
    "Hair Treatment": "hair-spa-treatment", "Hair Coloring": "hair-spa-treatment",
    "Basic Facial": "signature-facial", "Deep Cleansing Facial": "signature-facial",
    "Acne Facial": "carbon-laser-facial", "Brightening Facial": "pico-whitening-laser",
    "Anti-Aging Facial": "signature-facial", "Hydrating Facial": "signature-facial",
    "Signature Facial": "signature-facial", "HydraFacial": "signature-facial",
    "Diamond Peel": "diamond-peel", "LED Light Therapy": "carbon-laser-facial",
    "RF Facial": "carbon-laser-facial", "RF Body Contouring": "swedish-body-massage",
    "Cavitation": "swedish-body-massage", "HIFU Facial": "carbon-laser-facial",
    "Skin Booster": "signature-facial", "Microneedling": "carbon-laser-facial",
    "Underarm Whitening": "underarm-whitening", "Bikini Whitening": "underarm-whitening",
}

SERVICES = [
    {
        "name": name,
        "description": f"{name} service at Happy Skin Salon.",
        "price": float(price),
        "duration_minutes": duration,
        "image_url": f"/images/services/generated/{SERVICE_IMAGES[name]}.jpg",
        "is_active": True,
    }
    for name, price, duration in CATALOG
]
CURRENT_NAMES = {service["name"] for service in SERVICES}
BRANCH_NAMES = (
    "Happy Skin Main Branch",
    "Happy Skin Lipa Branch",
    "Happy Skin Cavite Branch",
)

db = SessionLocal()
try:
    for payload in SERVICES:
        service = db.query(Service).filter(Service.name == payload["name"]).first()
        if service:
            for field, value in payload.items():
                setattr(service, field, value)
        else:
            db.add(Service(**payload))
    db.flush()

    all_services = db.query(Service).all()
    for service in all_services:
        if service.name not in CURRENT_NAMES:
            service.is_active = False

    services_by_name = {service.name: service for service in all_services}
    for branch_name in BRANCH_NAMES:
        branch = db.query(Branch).filter(Branch.name == branch_name).first()
        if branch:
            branch.services = [services_by_name[name] for name in CURRENT_NAMES]

    db.commit()
    print(f"Upserted {len(SERVICES)} services and updated branch offerings.")
except Exception as error:
    db.rollback()
    print(f"Error: {error}")
finally:
    db.close()
