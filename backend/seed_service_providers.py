from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User


PROVIDERS = [
    # Main Branch
    (1, "Angela Reyes", "Senior Facialist", "angela.reyes"),
    (1, "Camille Mendoza", "Massage Therapist", "camille.mendoza"),
    (1, "Nicole Santos", "Nail Technician", "nicole.santos"),
    (1, "Patricia Cruz", "Skin Care Specialist", "patricia.cruz"),
    # Lipa Branch
    (2, "Bianca Garcia", "Hair Stylist", "bianca.garcia"),
    (2, "Jasmine Torres", "Lash and Brow Artist", "jasmine.torres"),
    (2, "Kristine Ramos", "Nail Technician", "kristine.ramos"),
    (2, "Marielle Flores", "Hair and Scalp Specialist", "marielle.flores"),
    # Cavite Branch
    (3, "Alyssa Bautista", "Laser Treatment Specialist", "alyssa.bautista"),
    (3, "Danica Villanueva", "Lash Technician", "danica.villanueva"),
    (3, "Francesca Lim", "Aesthetician", "francesca.lim"),
    (3, "Sofia Navarro", "Skin Whitening Specialist", "sofia.navarro"),
]


def seed_service_providers():
    db = SessionLocal()
    try:
        for branch_id, full_name, job_title, username in PROVIDERS:
            email = f"{username}@happyskinsalon.com"
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                user = User(email=email)
                db.add(user)
            user.full_name = full_name
            user.job_title = job_title
            user.role = "staff"
            user.branch_id = branch_id
            user.email_verified = True
            user.password_hash = hash_password("Provider@2026")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_service_providers()
