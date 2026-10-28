from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, func

from app.core.database import Base


class SyntheticImportBatch(Base):
    __tablename__ = "synthetic_import_batches"

    id = Column(Integer, primary_key=True)
    source_sha256 = Column(String(64), nullable=False, unique=True)
    source_name = Column(String(255), nullable=False)
    validation_report = Column(JSON, nullable=False)
    imported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SyntheticBranch(Base):
    __tablename__ = "synthetic_branches"
    __table_args__ = (UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_branch_batch_id"),)

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    synthetic_id = Column(String(40), nullable=False)
    name = Column(String(100), nullable=False)


class SyntheticService(Base):
    __tablename__ = "synthetic_services"
    __table_args__ = (UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_service_batch_id"),)

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    synthetic_id = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    duration_minutes = Column(Integer, nullable=False)


class SyntheticAppointment(Base):
    __tablename__ = "synthetic_appointments"
    __table_args__ = (
        UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_appointment_batch_id"),
        Index("ix_synthetic_appointment_batch_branch_date", "batch_id", "branch_id", "appointment_date"),
    )

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    synthetic_id = Column(String(40), nullable=False)
    branch_id = Column(String(40), nullable=False)
    service_id = Column(Integer, nullable=False)
    appointment_date = Column(DateTime(timezone=False), nullable=False)
    status = Column(String(20), nullable=False)
    customer_synthetic_id = Column(String(40), nullable=False)
    staff_synthetic_id = Column(String(40), nullable=False)


class SyntheticTransaction(Base):
    __tablename__ = "synthetic_transactions"
    __table_args__ = (UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_transaction_batch_id"),)

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    synthetic_id = Column(String(40), nullable=False)
    appointment_synthetic_id = Column(String(40), nullable=False, index=True)
    branch_id = Column(String(40), nullable=False)
    transaction_date = Column(DateTime(timezone=False), nullable=False)
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    payment_method = Column(String(30), nullable=False)


class SyntheticTransactionItem(Base):
    __tablename__ = "synthetic_transaction_items"
    __table_args__ = (
        UniqueConstraint("batch_id", "synthetic_id", name="uq_synthetic_item_batch_id"),
        Index("ix_synthetic_item_batch_transaction", "batch_id", "transaction_synthetic_id"),
    )

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    synthetic_id = Column(String(50), nullable=False)
    transaction_synthetic_id = Column(String(40), nullable=False)
    service_id = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)


class SyntheticDailyForecast(Base):
    __tablename__ = "synthetic_daily_forecasts"
    __table_args__ = (
        UniqueConstraint("batch_id", "forecast_date", "branch_id", "service_id", name="uq_synthetic_daily_forecast_key"),
        Index("ix_synthetic_daily_forecast_filter", "batch_id", "branch_id", "service_id", "forecast_date"),
    )

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("synthetic_import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    forecast_date = Column(Date, nullable=False)
    branch_id = Column(String(40), nullable=False)
    service_id = Column(Integer, nullable=False)
    bookings = Column(Integer, nullable=False)
    completed_bookings = Column(Integer, nullable=False)
    cancelled_bookings = Column(Integer, nullable=False)
    no_show_bookings = Column(Integer, nullable=False)
    daily_revenue = Column(Float, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    is_weekend = Column(Boolean, nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
