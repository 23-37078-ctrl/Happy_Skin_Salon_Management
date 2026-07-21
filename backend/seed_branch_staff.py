from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User


ACCOUNTS = [
    {
        "full_name": "Lipa Branch Staff",
        "email": "staff.lipa@happyskinsalon.com",
        "password": "LipaStaff@2026",
        "branch_id": 2,
    },
    {
        "full_name": "Batangas City Staff",
        "email": "staff.batangas@happyskinsalon.com",
        "password": "BatangasStaff@2026",
        "branch_id": 3,
    },
]


def seed_branch_staff():
    db = SessionLocal()
    try:
        for account in ACCOUNTS:
            user = db.query(User).filter(User.email == account["email"]).first()
            if user is None:
                user = User(email=account["email"])
                db.add(user)
            user.full_name = account["full_name"]
            user.password_hash = hash_password(account["password"])
            user.role = "staff"
            user.branch_id = account["branch_id"]
            user.email_verified = True
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_branch_staff()
