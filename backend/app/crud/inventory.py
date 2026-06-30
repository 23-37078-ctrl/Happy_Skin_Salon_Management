from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem


def get_inventory_for_branch(db: Session, branch_id: int) -> list[InventoryItem]:
    return (
        db.query(InventoryItem)
        .filter(InventoryItem.branch_id == branch_id, InventoryItem.is_active.is_(True))
        .order_by(InventoryItem.name.asc())
        .all()
    )


def get_low_stock_for_branch(db: Session, branch_id: int) -> list[InventoryItem]:
    return (
        db.query(InventoryItem)
        .filter(
            InventoryItem.branch_id == branch_id,
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity <= InventoryItem.minimum_stock,
        )
        .order_by(InventoryItem.quantity.asc(), InventoryItem.name.asc())
        .all()
    )


def build_inventory_summary(items: list[InventoryItem], low_stock_items: list[InventoryItem]) -> dict:
    return {
        "total_items": len(items),
        "low_stock_count": len(low_stock_items),
        "total_units": sum(item.quantity for item in items),
        "inventory_value": sum((item.quantity or 0) * float(item.unit_cost or 0) for item in items),
    }
