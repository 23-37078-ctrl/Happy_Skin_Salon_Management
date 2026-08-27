from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User


ACCOUNTS = [
    {
        "full_name": "Quezon City Branch Staff",
        "email": "quezon.staff@happyskinsalon.com",
        "legacy_email": "main.staff@happyskinsalon.com",
        "password": "QuezonStaff@2026!",
        "role": "staff",
        "branch_id": 1,
    },
    {
        "full_name": "Balete Drive Branch Staff",
        "email": "balete.staff@happyskinsalon.com",
        "legacy_email": "lipa.staff@happyskinsalon.com",
        "password": "BaleteStaff@2026!",
        "role": "staff",
        "branch_id": 2,
    },
    {
        "full_name": "Cavite Branch Staff",
        "email": "cavite.staff@happyskinsalon.com",
        "password": "CaviteStaff@2026!",
        "role": "staff",
        "branch_id": 3,
    },
    {
        "full_name": "Quezon City Branch Manager",
        "email": "quezon.manager@happyskinsalon.com",
        "legacy_email": "main.manager@happyskinsalon.com",
        "password": "QuezonManager@2026!",
        "role": "manager",
        "branch_id": 1,
    },
    {
        "full_name": "Balete Drive Branch Manager",
        "email": "balete.manager@happyskinsalon.com",
        "legacy_email": "lipa.manager@happyskinsalon.com",
        "password": "BaleteManager@2026!",
        "role": "manager",
        "branch_id": 2,
    },
    {
        "full_name": "Cavite Branch Manager",
        "email": "cavite.manager@happyskinsalon.com",
        "password": "CaviteManager@2026!",
        "role": "manager",
        "branch_id": 3,
    },
]


def seed_branch_staff():
    db = SessionLocal()
    try:
        for account in ACCOUNTS:
            user = db.query(User).filter(User.email == account["email"]).first()
            if user is None and account.get("legacy_email"):
                user = db.query(User).filter(User.email == account["legacy_email"]).first()
            if user is None:
                user = User(email=account["email"])
                db.add(user)
            user.email = account["email"]
            user.full_name = account["full_name"]
            user.password_hash = hash_password(account["password"])
            user.role = account["role"]
            user.branch_id = account["branch_id"]
            user.job_title = account.get("job_title")
            user.email_verified = True
            user.is_active = True
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_branch_staff()
