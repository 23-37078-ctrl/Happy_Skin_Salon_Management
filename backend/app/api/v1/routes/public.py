from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.service import Service
from app.models.branch import Branch

router = APIRouter(prefix="/public", tags=["Public"])


@router.get("/services")
def get_public_services(db: Session = Depends(get_db)):
    """Returns all active services — no authentication required."""
    services = (
        db.query(Service)
        .filter(Service.is_active.is_(True))
        .order_by(Service.name.asc())
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "price": s.price,
            "duration_minutes": s.duration_minutes,
            "image": s.image_url or "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80",
        }
        for s in services
    ]


@router.get("/branches")
def get_public_branches(db: Session = Depends(get_db)):
    """Returns all active branches — no authentication required."""
    branches = (
        db.query(Branch)
        .filter(Branch.is_active.is_(True))
        .order_by(Branch.name.asc())
        .all()
    )
    return [
        {
            "id": b.id,
            "name": b.name,
            "address": b.address,
            "phone": b.phone,
        }
        for b in branches
    ]