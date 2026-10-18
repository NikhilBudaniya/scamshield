import json
from datetime import datetime
from hashlib import sha256
from typing import Any
from sqlalchemy import DateTime, Index, JSON, String, create_engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase): pass


class RepositoryUnavailable(RuntimeError):
    """Storage could not complete a read or write safely."""


class DuplicateRequest(RuntimeError):
    """An owner-scoped idempotency key is already present."""


OWNER_CLIENT_INDEX = Index("uq_assessment_owner_client_request", "owner_session_id", "client_request_id", unique=True)


class StoredCase(Base):
    __tablename__ = "assessment_cases"
    __table_args__ = (OWNER_CLIENT_INDEX,)
    assessment_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_session_id: Mapped[str] = mapped_column(String(128), nullable=False, default="local-unprotected", index=True)
    client_request_id: Mapped[str] = mapped_column(String(120), nullable=False)
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

    def initialize(self):
        Base.metadata.create_all(self.engine)
        columns = {column["name"] for column in inspect(self.engine).get_columns(StoredCase.__tablename__)}
        if "owner_session_id" not in columns:
            # Existing cases belong to a reserved legacy owner. New authenticated
            # sessions cannot address this owner; local no-auth mode keeps its own
            # stable owner and remains backward compatible.
            with self.engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE assessment_cases ADD COLUMN owner_session_id "
                    "VARCHAR(128) NOT NULL DEFAULT 'legacy'"
                ))
        with self.engine.begin() as connection:
            for index in inspect(self.engine).get_indexes(StoredCase.__tablename__):
                if index.get("unique") and index.get("column_names") == ["client_request_id"]:
                    connection.execute(text(f'DROP INDEX IF EXISTS "{index["name"]}"'))
        index_names = {index["name"] for index in inspect(self.engine).get_indexes(StoredCase.__tablename__)}
        if "uq_assessment_owner_client_request" not in index_names:
            OWNER_CLIENT_INDEX.create(self.engine, checkfirst=True)

    @staticmethod
    def request_hash(request_dict: dict) -> str:
        without_id = {k: v for k, v in request_dict.items() if k != "client_request_id"}
        encoded = json.dumps(without_id, sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=False).encode()
        return sha256(encoded).hexdigest()

    def find_by_client_id(self, owner_session_id: str, client_id: str):
        with self.sessions() as db:
            row = db.scalar(select(StoredCase).where(StoredCase.owner_session_id == owner_session_id, StoredCase.client_request_id == client_id))
            return (row.payload, row.payload_hash) if row else (None, None)

    def save_case(self, case: dict, request_hash: str, owner_session_id: str):
        with self.sessions.begin() as db:
            db.add(StoredCase(assessment_id=case["assessment_id"], owner_session_id=owner_session_id, client_request_id=case["request"]["client_request_id"], payload_hash=request_hash, created_at=datetime.fromisoformat(case["created_at"]), payload=case))

    def list_cases(self, owner_session_id: str = "local-unprotected", limit: int = 100):
        with self.sessions() as db:
            rows = db.scalars(select(StoredCase).where(StoredCase.owner_session_id == owner_session_id).order_by(StoredCase.created_at.desc()).limit(limit)).all()
            return [row.payload for row in rows]

    def get_case(self, case_id: str, owner_session_id: str = "local-unprotected"):
        with self.sessions() as db:
            row = db.scalar(select(StoredCase).where(StoredCase.assessment_id == case_id, StoredCase.owner_session_id == owner_session_id))
            return row.payload if row else None

    def update_case(self, case_id: str, payload: dict, owner_session_id: str = "local-unprotected"):
        with self.sessions.begin() as db:
            row = db.scalar(select(StoredCase).where(StoredCase.assessment_id == case_id, StoredCase.owner_session_id == owner_session_id))
            if row is None: return False
            row.payload = payload
            return True
