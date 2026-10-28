from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User


# Demo provider roster: 3 nail technicians, 2 nurses, and 5 other staff per branch.
# Existing seeded accounts are retained where possible so rerunning this script is safe.
PROVIDERS = [
    # Main Branch
    (1, "Nicole Santos", "Nail Technician", "nicole.santos"),
    (1, "Mikaela Ramos", "Nail Technician", "mikaela.ramos"),
    (1, "Sofia Dela Cruz", "Nail Technician", "sofia.delacruz"),
    (1, "Angela Reyes", "Nurse", "angela.reyes"),
    (1, "Patricia Cruz", "Nurse", "patricia.cruz"),
    (1, "Camille Mendoza", "Other Staff", "camille.mendoza"),
    (1, "Lara Garcia", "Other Staff", "lara.garcia"),
    (1, "Bea Torres", "Other Staff", "bea.torres"),
    (1, "Trisha Lim", "Other Staff", "trisha.lim"),
    (1, "May Flores", "Other Staff", "may.flores"),
    # Lipa Branch
    (2, "Kristine Ramos", "Nail Technician", "kristine.ramos"),
    (2, "Ella Bautista", "Nail Technician", "ella.bautista"),
    (2, "Celine Navarro", "Nail Technician", "celine.navarro"),
    (2, "Mara Villanueva", "Nurse", "mara.villanueva"),
    (2, "Rina Castillo", "Nurse", "rina.castillo"),
    (2, "Bianca Garcia", "Other Staff", "bianca.garcia"),
    (2, "Jasmine Torres", "Other Staff", "jasmine.torres"),
    (2, "Marielle Flores", "Other Staff", "marielle.flores"),
    (2, "Nina Mendoza", "Other Staff", "nina.mendoza"),
    (2, "Kyla Reyes", "Other Staff", "kyla.reyes"),
    # Cavite Branch
    (3, "Alyssa Bautista", "Nurse", "alyssa.bautista"),
    (3, "Danica Villanueva", "Other Staff", "danica.villanueva"),
    (3, "Francesca Lim", "Nurse", "francesca.lim"),
    (3, "Sofia Navarro", "Other Staff", "sofia.navarro"),
    (3, "Isabella Cruz", "Nail Technician", "isabella.cruz"),
    (3, "Mia Santos", "Nail Technician", "mia.santos"),
    (3, "Cheska Ramos", "Nail Technician", "cheska.ramos"),
    (3, "Gabrielle Reyes", "Other Staff", "gabrielle.reyes"),
    (3, "Tina Mendoza", "Other Staff", "tina.mendoza"),
    (3, "Alexis Garcia", "Other Staff", "alexis.garcia"),
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
