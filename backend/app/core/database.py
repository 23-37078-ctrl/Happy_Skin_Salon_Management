import logging

from sqlalchemy import create_engine
from sqlalchemy import event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

engine_options = {"pool_pre_ping": True}
if settings.DATABASE_URL.startswith("postgresql"):
    engine_options.update(
        connect_args={"connect_timeout": settings.DATABASE_CONNECT_TIMEOUT_SECONDS},
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )

engine = create_engine(settings.DATABASE_URL, **engine_options)


@event.listens_for(engine, "handle_error")
def log_database_connection_failures(exception_context):
    original = exception_context.original_exception
    if exception_context.is_disconnect or exception_context.connection is None:
        logger.error(
            "Database connection failed (type=%s, disconnect=%s). Check DATABASE_URL host, Supabase project status, port access, and credentials.",
            type(original).__name__,
            exception_context.is_disconnect,
        )


logger = logging.getLogger(__name__)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
from app.models import *
