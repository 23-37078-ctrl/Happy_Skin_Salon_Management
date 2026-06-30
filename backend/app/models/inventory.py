from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)

    name = Column(String(120), nullable=False)
    sku = Column(String(60), nullable=True)
    category = Column(String(80), nullable=True)
    quantity = Column(Integer, default=0, nullable=False)
    minimum_stock = Column(Integer, default=5, nullable=False)
    unit = Column(String(30), default="pcs", nullable=False)
    unit_cost = Column(Float, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch")
