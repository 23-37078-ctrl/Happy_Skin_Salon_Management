from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.service import Service
from app.models.branch import Branch
from app.models.inventory import InventoryItem

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


@router.get("/discovery")
def get_public_discovery(db: Session = Depends(get_db)):
    """Public branch catalog with bookable services and safe product availability."""
    branches = (
        db.query(Branch)
        .options(selectinload(Branch.services))
        .filter(Branch.is_active.is_(True))
        .order_by(Branch.name.asc())
        .all()
    )
    services = (
        db.query(Service)
        .filter(Service.is_active.is_(True))
        .order_by(Service.name.asc())
        .all()
    )
    inventory = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity > 0,
        )
        .order_by(InventoryItem.name.asc())
        .all()
    )

    products_by_branch: dict[int, list[dict]] = {}
    for item in inventory:
        products_by_branch.setdefault(item.branch_id, []).append(
            {
                "id": item.id,
                "name": item.name,
                "category": item.category or "Beauty essential",
                "unit": item.unit,
                "available": True,
            }
        )

    public_services = [
        {
            "id": service.id,
            "name": service.name,
            "description": service.description,
            "price": service.price,
            "duration_minutes": service.duration_minutes,
            "image": service.image_url
            or "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=700&q=80",
        }
        for service in services
    ]

    return {
        "branches": [
            {
                "id": branch.id,
                "name": branch.name,
                "address": branch.address,
                "phone": branch.phone,
                "services": [
                    service
                    for service in public_services
                    if service["id"] in {item.id for item in branch.services}
                ],
                "products": products_by_branch.get(branch.id, []),
            }
            for branch in branches
        ],
        "services": public_services,
    }
