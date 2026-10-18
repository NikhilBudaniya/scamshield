"""Firestore repository with owner-scoped paths and transactional quotas."""
from __future__ import annotations

from datetime import date, datetime, timezone
from hashlib import sha256
from typing import Any

from .repository import DuplicateRequest, RepositoryUnavailable

FIRESTORE_RPC_TIMEOUT_SECONDS = 10


class ModelQuotaExceeded(RuntimeError):
    pass


def _owner_key(owner_id: str) -> str:
    return sha256(owner_id.encode("utf-8")).hexdigest()


class FirestoreRepository:
    """Small repository interface compatible with the SQLite assessment service."""

    def __init__(self, project_id: str | None = None, client=None):
        self.project_id = project_id
        self._client = client

    @property
    def client(self):
        if self._client is None:
            try:
                from google.cloud import firestore
                self._client = firestore.Client(project=self.project_id)
            except Exception as exc:
                raise RepositoryUnavailable("Firestore is unavailable") from exc
        return self._client

    def initialize(self):
        # Firestore creates collections/documents on demand; ADC is used by its client.
        _ = self.client

    @staticmethod
    def request_hash(request_dict: dict) -> str:
        from .repository import Repository
        return Repository.request_hash(request_dict)

    def _owner_ref(self, owner_id: str):
        return self.client.collection("visitors").document(_owner_key(owner_id))

    def _case_ref(self, owner_id: str, case_id: str):
        return self._owner_ref(owner_id).collection("cases").document(case_id)

    def _request_ref(self, owner_id: str, client_id: str):
        return self._owner_ref(owner_id).collection("request_ids").document(sha256(client_id.encode()).hexdigest())

    @staticmethod
    def _payload(snapshot):
        data = snapshot.to_dict() if snapshot.exists else None
        return data.get("payload") if data else None

    def find_by_client_id(self, owner_id: str, client_id: str):
        try:
            index = self._request_ref(owner_id, client_id).get(timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
            if not index.exists:
                return None, None
            data = index.to_dict()
            case = self._case_ref(owner_id, data["assessment_id"]).get(timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
            payload = self._payload(case)
            return (payload, data["payload_hash"]) if payload else (None, None)
        except RepositoryUnavailable:
            raise
        except Exception as exc:
            raise RepositoryUnavailable("Firestore read failed") from exc

    def save_case(self, case: dict, request_hash: str, owner_id: str):
        try:
            from google.cloud import firestore
            transaction = self.client.transaction()
            index_ref = self._request_ref(owner_id, case["request"]["client_request_id"])
            case_ref = self._case_ref(owner_id, case["assessment_id"])

            @firestore.transactional
            def save(tx):
                existing = index_ref.get(transaction=tx, timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
                if existing.exists:
                    raise DuplicateRequest("client request id already exists")
                tx.create(case_ref, {"payload": case, "created_at": datetime.fromisoformat(case["created_at"])})
                tx.create(index_ref, {"assessment_id": case["assessment_id"], "payload_hash": request_hash})

            save(transaction)
        except DuplicateRequest:
            raise
        except Exception as exc:
            raise RepositoryUnavailable("Firestore write failed") from exc

    def list_cases(self, owner_id: str, limit: int = 100):
        try:
            query = (self._owner_ref(owner_id).collection("cases")
                     .order_by("created_at", direction="DESCENDING").limit(min(limit, 100)))
            return [doc.to_dict()["payload"] for doc in query.stream(timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)]
        except Exception as exc:
            raise RepositoryUnavailable("Firestore list failed") from exc

    def get_case(self, case_id: str, owner_id: str):
        try:
            return self._payload(self._case_ref(owner_id, case_id).get(timeout=FIRESTORE_RPC_TIMEOUT_SECONDS))
        except Exception as exc:
            raise RepositoryUnavailable("Firestore read failed") from exc

    def update_case(self, case_id: str, payload: dict, owner_id: str):
        try:
            from google.cloud import firestore
            ref = self._case_ref(owner_id, case_id)
            transaction = self.client.transaction()

            @firestore.transactional
            def update(tx):
                snapshot = ref.get(transaction=tx, timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
                if not snapshot.exists:
                    return False
                previous = snapshot.to_dict()
                tx.set(ref, {"payload": payload, "created_at": previous["created_at"]})
                return True

            return update(transaction)
        except Exception as exc:
            raise RepositoryUnavailable("Firestore update failed") from exc

    def reserve_model_usage(self, owner_id: str, *, per_user_limit: int, global_limit: int,
                            total_limit: int = 500, today: date | None = None):
        """Atomically reserve a per-user/day, global/day, and global-lifetime attempt."""
        day = (today or datetime.now(timezone.utc).date()).isoformat()
        try:
            from google.cloud import firestore
            usage = self.client.collection("model_usage").document(day)
            user = usage.collection("users").document(_owner_key(owner_id))
            lifetime = self.client.collection("model_usage").document("lifetime")
            transaction = self.client.transaction()

            @firestore.transactional
            def reserve(tx):
                global_snapshot = usage.get(transaction=tx, timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
                user_snapshot = user.get(transaction=tx, timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
                lifetime_snapshot = lifetime.get(transaction=tx, timeout=FIRESTORE_RPC_TIMEOUT_SECONDS)
                global_count = int((global_snapshot.to_dict() or {}).get("count", 0)) if global_snapshot.exists else 0
                user_count = int((user_snapshot.to_dict() or {}).get("count", 0)) if user_snapshot.exists else 0
                lifetime_count = int((lifetime_snapshot.to_dict() or {}).get("count", 0)) if lifetime_snapshot.exists else 0
                if global_count >= global_limit or user_count >= per_user_limit or lifetime_count >= total_limit:
                    return False
                tx.set(usage, {"count": global_count + 1, "date": day}, merge=True)
                tx.set(user, {"count": user_count + 1, "date": day}, merge=True)
                tx.set(lifetime, {"count": lifetime_count + 1}, merge=True)
                return True

            if not reserve(transaction):
                raise ModelQuotaExceeded("model request limit reached")
        except ModelQuotaExceeded:
            raise
        except Exception as exc:
            raise RepositoryUnavailable("Firestore quota reservation failed") from exc
