import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.service import Service

SERVICES = [
    {"name": "Signature Facial", "description": "Deep cleansing facial for refreshed and glowing skin.", "price": 899.00, "duration_minutes": 60, "image_url": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80", "is_active": True},
    {"name": "Diamond Peel", "description": "Gentle exfoliation service for smoother skin texture.", "price": 1299.00, "duration_minutes": 75, "image_url": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80", "is_active": True},
    {"name": "Brow Care", "description": "Brow shaping and grooming for a polished salon look.", "price": 349.00, "duration_minutes": 30, "image_url": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=700&q=80", "is_active": True},
    {"name": "Pico Whitening Laser", "description": "Brightening laser session for dark spots and uneven tone.", "price": 1499.00, "duration_minutes": 45, "image_url": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80", "is_active": True},
    {"name": "Hair Rebond", "description": "Smoothing hair treatment for a straighter polished finish.", "price": 999.00, "duration_minutes": 180, "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=700&q=80", "is_active": True},
    {"name": "Gel Manicure", "description": "Clean nail care with long-wear gel polish.", "price": 450.00, "duration_minutes": 60, "image_url": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=700&q=80", "is_active": True},
    {"name": "Foot Spa with Massage", "description": "Foot soak, scrub, and massage for relaxation.", "price": 550.00, "duration_minutes": 60, "image_url": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=700&q=80", "is_active": True},
    {"name": "Classic Eyelash Extension", "description": "Natural lash extension set for everyday definition.", "price": 799.00, "duration_minutes": 90, "image_url": "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=700&q=80", "is_active": True},
]

db = SessionLocal()
try:
    count = db.query(Service).count()
    if count > 0:
        print(f"Already have {count} services. Skipping.")
    else:
        for s in SERVICES:
            db.add(Service(**s))
        db.commit()
        print(f"Seeded {len(SERVICES)} services successfully!")
        for s in SERVICES:
            print(f"  + {s['name']} — PHP {s['price']:,.0f}")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
