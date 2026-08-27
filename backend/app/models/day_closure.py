from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class DayClosure(Base):
    __tablename__ = "day_closures"
    __table_args__ = (UniqueConstraint("branch_id", "business_date", name="uq_day_closure_branch_date"),)

    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    business_date = Column(Date, nullable=False, index=True)
    closed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime, nullable=False, server_default=func.now())

    closed_by = relationship("User")
