import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.branch import Branch
from app.models.service import Service

SERVICES = [
    {"name": "Signature Facial", "description": "Deep cleansing facial for refreshed and glowing skin.", "price": 899.00, "duration_minutes": 60, "image_url": "/images/services/generated/signature-facial.jpg", "is_active": True},
    {"name": "Diamond Peel", "description": "Gentle exfoliation service for smoother skin texture.", "price": 1299.00, "duration_minutes": 75, "image_url": "/images/services/generated/diamond-peel.jpg", "is_active": True},
    {"name": "Brow Care", "description": "Brow shaping and grooming for a polished salon look.", "price": 349.00, "duration_minutes": 30, "image_url": "/images/services/generated/brow-care.jpg", "is_active": True},
    {"name": "Pico Whitening Laser", "description": "Brightening laser session for dark spots and uneven tone.", "price": 1499.00, "duration_minutes": 45, "image_url": "/images/services/generated/pico-whitening-laser.jpg", "is_active": True},
    {"name": "Hair Rebond", "description": "Smoothing hair treatment for a straighter polished finish.", "price": 999.00, "duration_minutes": 180, "image_url": "/images/services/generated/hair-rebond.jpg", "is_active": True},
    {"name": "Gel Manicure", "description": "Clean nail care with long-wear gel polish.", "price": 450.00, "duration_minutes": 60, "image_url": "/images/services/generated/gel-manicure.jpg", "is_active": True},
    {"name": "Foot Spa with Massage", "description": "Foot soak, scrub, and massage for relaxation.", "price": 550.00, "duration_minutes": 60, "image_url": "/images/services/generated/foot-spa-massage.jpg", "is_active": True},
    {"name": "Classic Eyelash Extension", "description": "Natural lash extension set for everyday definition.", "price": 799.00, "duration_minutes": 90, "image_url": "/images/services/generated/classic-eyelash-extension.jpg", "is_active": True},
    {"name": "Swedish Body Massage", "description": "A gentle full-body massage that promotes relaxation and eases everyday tension.", "price": 750.00, "duration_minutes": 60, "image_url": "/images/services/generated/swedish-body-massage.jpg", "is_active": True},
    {"name": "Deep Tissue Massage", "description": "Focused massage using firm pressure to relieve tight and tired muscles.", "price": 950.00, "duration_minutes": 75, "image_url": "/images/services/generated/deep-tissue-massage.jpg", "is_active": True},
    {"name": "Hair Spa Treatment", "description": "Nourishing scalp and hair treatment for softer, healthier-looking hair.", "price": 699.00, "duration_minutes": 75, "image_url": "/images/services/generated/hair-spa-treatment.jpg", "is_active": True},
    {"name": "Classic Pedicure", "description": "Complete nail shaping, cuticle care, foot smoothing, and classic polish.", "price": 399.00, "duration_minutes": 50, "image_url": "/images/services/generated/classic-pedicure.jpg", "is_active": True},
    {"name": "Carbon Laser Facial", "description": "Laser facial treatment designed to clarify pores and refresh uneven-looking skin.", "price": 1699.00, "duration_minutes": 60, "image_url": "/images/services/generated/carbon-laser-facial.jpg", "is_active": True},
    {"name": "Lash Lift and Tint", "description": "Lifts and darkens natural lashes for a defined, low-maintenance look.", "price": 899.00, "duration_minutes": 60, "image_url": "/images/services/generated/lash-lift-tint.jpg", "is_active": True},
    {"name": "Underarm Whitening", "description": "A gentle brightening treatment for smoother and more even-looking underarms.", "price": 999.00, "duration_minutes": 45, "image_url": "/images/services/generated/underarm-whitening.jpg", "is_active": True},
]

ALL_SERVICE_NAMES = [service["name"] for service in SERVICES]

BRANCH_SERVICES = {
    "Happy Skin Main Branch": ALL_SERVICE_NAMES,
    "Happy Skin Lipa Branch": ALL_SERVICE_NAMES,
    "Happy Skin Cavite Branch": ALL_SERVICE_NAMES,
}

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

    services_by_name = {service.name: service for service in db.query(Service).all()}
    for branch_name, service_names in BRANCH_SERVICES.items():
        branch = db.query(Branch).filter(Branch.name == branch_name).first()
        if branch:
            branch.services = [services_by_name[name] for name in service_names]

    db.commit()
    print(f"Upserted {len(SERVICES)} services and updated branch offerings.")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
