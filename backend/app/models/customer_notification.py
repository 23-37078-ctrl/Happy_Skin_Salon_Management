from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func

from app.core.database import Base


class CustomerNotificationRead(Base):
    __tablename__ = "customer_notification_reads"
    __table_args__ = (UniqueConstraint("customer_id", "notification_id", name="uq_customer_notification_read"),)

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_id = Column(String(100), nullable=False)
    read_at = Column(DateTime, nullable=False, server_default=func.now())
