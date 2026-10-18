"""Firebase ID-token verification. Caller identity comes only from verified claims."""
from __future__ import annotations

from threading import Lock

_init_lock = Lock()
_app = None


def verify_firebase_token(token: str, project_id: str) -> str:
    global _app
    try:
        import firebase_admin
        from firebase_admin import auth

        with _init_lock:
            if _app is None:
                try:
                    _app = firebase_admin.get_app()
                except ValueError:
                    _app = firebase_admin.initialize_app(options={"projectId": project_id})
        decoded = auth.verify_id_token(token, app=_app, check_revoked=True)
        uid = decoded.get("uid")
        if not isinstance(uid, str) or not uid:
            raise ValueError("missing uid")
        return uid
    except Exception as exc:
        # Do not expose token or verifier details to callers.
        raise ValueError("invalid_firebase_token") from exc
