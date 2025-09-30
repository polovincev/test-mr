"""Database setup for development/testing: SQLite in-memory shared across threads."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pathlib import Path

# ---------------------------------------------------------------------------
# SQLAlchemy engine / session (in-memory SQLite shared with StaticPool)
# ---------------------------------------------------------------------------

DB_FILE = Path(__file__).resolve().parents[2] / "app.db"
SQLALCHEMY_DATABASE_URL = f"sqlite+pysqlite:///{DB_FILE}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},  # allow multi-thread access
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()

def get_db() -> Session:
    """Yield a database session (FastAPI dependency)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
