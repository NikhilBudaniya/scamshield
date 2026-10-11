import json
from datetime import datetime
from hashlib import sha256
from typing import Any
from sqlalchemy import DateTime, Integer, JSON, String, Text, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase): pass


class StoredCase(Base):
    __tablename__ = "assessment_cases"
    assessment_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    client_request_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class Repository:
    def __init__(self, url: str):
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgres://")
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
        options = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine = create_engine(url, connect_args=options, pool_pre_ping=True)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)

    def initialize(self): Base.metadata.create_all(self.engine)

    @staticmethod
    def request_hash(request_dict: dict) -> str:
        without_id = {k: v for k, v in request_dict.items() if k != "client_request_id"}
        encoded = json.dumps(without_id, sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=False).encode()
        return sha256(encoded).hexdigest()

    def find_by_client_id(self, client_id: str):
        with self.sessions() as db:
            row = db.scalar(select(StoredCase).where(StoredCase.client_request_id == client_id))
            return (row.payload, row.payload_hash) if row else (None, None)

    def save_case(self, case: dict, request_hash: str):
        with self.sessions.begin() as db:
            db.add(StoredCase(assessment_id=case["assessment_id"], client_request_id=case["request"]["client_request_id"], payload_hash=request_hash, created_at=datetime.fromisoformat(case["created_at"]), payload=case))

    def list_cases(self, limit: int = 100):
        with self.sessions() as db:
            rows = db.scalars(select(StoredCase).order_by(StoredCase.created_at.desc()).limit(limit)).all()
            return [row.payload for row in rows]

    def get_case(self, case_id: str):
        with self.sessions() as db:
            row = db.get(StoredCase, case_id)
            return row.payload if row else None

    def update_case(self, case_id: str, payload: dict):
        with self.sessions.begin() as db:
            row = db.get(StoredCase, case_id)
            if row is None: return False
            row.payload = payload
            return True
