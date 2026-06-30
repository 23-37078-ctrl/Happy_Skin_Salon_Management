from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class InventoryItemOut(BaseModel):
    id: int
    branch_id: int
    name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    quantity: int
    minimum_stock: int
    unit: str
    unit_cost: float
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InventorySummary(BaseModel):
    total_items: int
    low_stock_count: int
    total_units: int
    inventory_value: float


class InventoryListResponse(BaseModel):
    items: list[InventoryItemOut]
    low_stock_items: list[InventoryItemOut]
    summary: InventorySummary
