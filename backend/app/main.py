import hashlib
import hmac
import asyncio
import os
import secrets
import threading
import time
from pathlib import Path
from fastapi import Cookie, Depends, FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from .config import get_settings
from .config import validate_gemini_config
from .auth import verify_firebase_token
from .firestore_repository import FirestoreRepository
from .repository import RepositoryUnavailable
from .invoices import ASSET_DIR, MAX_INVOICE_BYTES, SAMPLES, public_samples, sample_for_bytes, validate_upload_async
from .providers import GeminiProvider, JevProvider
from .repository import Repository
from .schemas import AssessmentRequest
from .service import AssessmentService

settings = get_settings()
repository = (FirestoreRepository(settings.effective_firebase_project_id)
              if settings.storage_backend == "firestore" else Repository(settings.database_url))
service = AssessmentService(repository, JevProvider(settings), GeminiProvider(settings))
app = FastAPI(title="ScamShield API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[], allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"], allow_credentials=True)
JSON_REQUEST_BODY_LIMIT_BYTES = 256 * 1024
INVOICE_PDF_BODY_LIMIT_BYTES = 5 * 1024 * 1024
INVOICE_MULTIPART_ENVELOPE_BYTES = 64 * 1024
INVOICE_PDF_UPLOAD_PATH = "/api/v1/invoices/extract"


class _RequestBodyTooLarge(Exception):
    pass


class RequestBodySizeLimitMiddleware:
    """Reject oversized bodies before FastAPI's JSON parser buffers them."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_type = headers.get(b"content-type", b"").split(b";", 1)[0].strip().lower()
        is_pdf_upload = scope.get("path") == INVOICE_PDF_UPLOAD_PATH and content_type in {b"application/pdf", b"multipart/form-data"}
        limit = (INVOICE_PDF_BODY_LIMIT_BYTES + INVOICE_MULTIPART_ENVELOPE_BYTES
                 if is_pdf_upload and content_type == b"multipart/form-data"
                 else INVOICE_PDF_BODY_LIMIT_BYTES if is_pdf_upload else JSON_REQUEST_BODY_LIMIT_BYTES)
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > limit:
                    await self._reject(send)
                    return
            except ValueError:
                pass

        size = 0
        response_started = False

        async def limited_receive():
            nonlocal size
            message = await receive()
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > limit:
                    raise _RequestBodyTooLarge
            return message

        async def track_send(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, track_send)
        except _RequestBodyTooLarge:
            if not response_started:
                await self._reject(send)

    @staticmethod
    async def _reject(send):
        body = b'{"detail":"request body too large"}'
        await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


app.add_middleware(RequestBodySizeLimitMiddleware)
session_counts: dict[str, dict] = {}
login_attempts: dict[str, list[float]] = {}
session_state_lock = threading.RLock()


@app.on_event("startup")
def startup():
    if settings.context_provider not in {"jev", "gemini"}:
        raise RuntimeError("CONTEXT_PROVIDER must be jev or gemini")
    try:
        validate_gemini_config(settings)
    except ValueError as exc:
        raise RuntimeError(str(exc)) from exc
    is_managed = bool(os.environ.get("K_SERVICE")) or settings.environment.casefold() == "production"
    if is_managed and settings.local_development:
        raise RuntimeError("LOCAL_DEVELOPMENT must be false in production or Cloud Run")
    if is_managed and settings.auth_mode == "firebase" and settings.storage_backend != "firestore":
        raise RuntimeError("Production Firebase auth requires STORAGE_BACKEND=firestore for durable cases and model quotas")
    if is_managed and settings.auth_mode == "access_code" and not settings.access_code:
        raise RuntimeError("Production access-code mode requires DEMO_ACCESS_CODE")
    if is_managed and settings.auth_mode == "access_code" and (settings.session_secret == "local-demo-secret-change-me" or len(settings.session_secret) < 32):
        raise RuntimeError("Production access-code sessions require SESSION_SECRET with at least 32 characters")
    if is_managed and settings.auth_mode == "access_code" and not settings.cookie_secure:
        raise RuntimeError("Production access-code sessions require COOKIE_SECURE=true")
    if settings.auth_mode == "access_code" and settings.access_code and (settings.session_secret == "local-demo-secret-change-me" or len(settings.session_secret) < 32):
        raise RuntimeError("Protected sessions require SESSION_SECRET with at least 32 characters")
    if settings.auth_mode == "access_code" and settings.access_code and not settings.cookie_secure and (is_managed or not settings.local_development):
        raise RuntimeError("Protected sessions require COOKIE_SECURE=true, or explicit LOCAL_DEVELOPMENT=true for local HTTP")
    if settings.auth_mode == "firebase":
        required = (settings.effective_firebase_project_id, settings.firebase_api_key, settings.firebase_auth_domain, settings.firebase_app_id)
        if not all(required):
            raise RuntimeError("Firebase auth mode requires project ID and Firebase web config (API key, auth domain, app ID)")
    if settings.storage_backend == "firestore" and not settings.effective_firebase_project_id:
        raise RuntimeError("Firestore storage requires GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID")
    live_context = (settings.context_provider == "jev" and settings.jev_mode == "live") or (settings.context_provider == "gemini" and settings.gemini_mode == "live")
    if (live_context or settings.gemini_mode == "live") and settings.auth_mode != "firebase" and not settings.access_code:
        raise RuntimeError("Live provider mode requires Firebase auth or DEMO_ACCESS_CODE to prevent an unrestricted model proxy")
    repository.initialize()


def _token(session_id: str, expires_at: int) -> str:
    payload = f"{session_id}.{expires_at}"
    sig = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _session_id(token: str | None):
    if not settings.access_code: return "local-unprotected"
    now = time.time()
    if not token or "." not in token: raise HTTPException(401, "authenticated session required")
    try: sid, expiration_text, sig = token.rsplit(".", 2); expiration = int(expiration_text)
    except (ValueError, TypeError): raise HTTPException(401, "authenticated session required")
    payload = f"{sid}.{expiration_text}"
    expected = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if expiration < int(time.time()) or not hmac.compare_digest(sig, expected): raise HTTPException(401, "authenticated session required")
    with session_state_lock:
        for expired_id, session in list(session_counts.items()):
            if session["expires"] < now: session_counts.pop(expired_id, None)
        session = session_counts.get(sid)
        if session is None or session["expires"] < time.time():
            session_counts.pop(sid, None)
            raise HTTPException(401, "authenticated session expired")
    return sid


def require_session(scamshield_session: str | None = Cookie(default=None), authorization: str | None = Header(default=None)):
    if settings.auth_mode == "firebase":
        project_id = settings.effective_firebase_project_id
        if not project_id or not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "valid Firebase bearer token required")
        try:
            return verify_firebase_token(authorization[7:], project_id)
        except ValueError as exc:
            raise HTTPException(401, "invalid Firebase bearer token") from exc
    return _session_id(scamshield_session)


@app.get("/api/config")
def public_config():
    firebase_config = None
    if settings.auth_mode == "firebase":
        firebase_config = {"apiKey": settings.firebase_api_key, "authDomain": settings.firebase_auth_domain,
                           "projectId": settings.effective_firebase_project_id, "appId": settings.firebase_app_id}
    return {"auth_mode": settings.auth_mode, "firebase_config": firebase_config,
            "storage_mode": settings.storage_backend, "synthetic_data": True}


@app.get("/api/health")
def health():
    auth_required = settings.auth_mode == "firebase" or (settings.auth_mode == "access_code" and bool(settings.access_code))
    return {"status": "ok", "provider_modes": {"jev": settings.jev_mode, "gemini": settings.gemini_mode, "context_provider": settings.context_provider}, "auth_required": auth_required, "access_mode": settings.auth_mode if auth_required else "local_unprotected", "storage_mode": settings.storage_backend, "synthetic_data": True}


@app.post("/api/session")
def create_session(body: dict, response: Response, request: Request):
    if settings.auth_mode == "firebase":
        raise HTTPException(404, "access-code sessions are disabled")
    if not settings.access_code:
        return {"authenticated": False, "access_mode": "local_unprotected"}
    now = time.time()
    ip = request.client.host if request.client else "unknown"
    with session_state_lock:
        for expired_id, session in list(session_counts.items()):
            if session["expires"] < now: session_counts.pop(expired_id, None)
        for known_ip, attempts in list(login_attempts.items()):
            login_attempts[known_ip] = [when for when in attempts if now - when < 60]
            if not login_attempts[known_ip]: login_attempts.pop(known_ip, None)
        attempts = login_attempts.setdefault(ip, [])
        if len(attempts) >= settings.max_login_attempts_per_minute:
            raise HTTPException(429, "too many session creation attempts")
        # Count failed and successful submissions, so the endpoint cannot mint
        # unlimited sessions by repeatedly supplying the shared access code.
        attempts.append(now)
        if len(session_counts) >= settings.max_active_sessions:
            raise HTTPException(429, "active session limit reached")
        if set(body) != {"access_code"} or not isinstance(body.get("access_code"), str) or not hmac.compare_digest(body["access_code"], settings.access_code):
            raise HTTPException(401, "invalid access code")
        sid = secrets.token_urlsafe(24)
        expiration = int(time.time()) + settings.session_ttl_seconds
        response.set_cookie("scamshield_session", _token(sid, expiration), httponly=True, secure=settings.cookie_secure, samesite="strict", max_age=settings.session_ttl_seconds, path="/")
        session_counts[sid] = {"count": 0, "explanations": 0, "expires": expiration}
    return {"authenticated": True, "access_mode": "protected", "expires_in_seconds": settings.session_ttl_seconds}


@app.get("/api/v1/scenarios")
def scenarios(session_id: str = Depends(require_session)):
    from .seed import SCENARIOS
    return {"scenarios": SCENARIOS}


@app.get("/api/v1/invoices/vendors")
def invoice_vendors(owner_id: str = Depends(require_session)):
    from .seed import VENDORS
    return {"vendors": [{"vendor_id": vendor_id, "vendor_name": "Acme Supplies",
                          "customer_id": info["business_id"], "known_destination": info["destination_account"]}
                         for vendor_id, info in VENDORS.items()]}


@app.get("/api/v1/invoices/samples")
def invoice_samples(owner_id: str = Depends(require_session)):
    return {"samples": public_samples()}


@app.get("/api/v1/invoices/samples/{sample_id}/download")
def download_invoice_sample(sample_id: str, owner_id: str = Depends(require_session)):
    sample = SAMPLES.get(sample_id)
    if sample is None:
        raise HTTPException(404, "invoice sample not found")
    path = (ASSET_DIR / sample["file"]).resolve()
    if path.parent != ASSET_DIR.resolve() or not path.is_file():
        raise HTTPException(503, "invoice sample unavailable")
    return FileResponse(path, media_type="application/pdf", filename=sample["filename"])


@app.post("/api/v1/invoices/extract")
async def extract_invoice(file: UploadFile = File(...), sample_id: str | None = Form(default=None),
                         owner_id: str = Depends(require_session)):
    if sample_id is not None and sample_id not in SAMPLES:
        raise HTTPException(422, "unknown invoice sample")
    data = await file.read(MAX_INVOICE_BYTES + 1)
    try:
        mime_type = await validate_upload_async(data, file.content_type or "")
    except OverflowError as exc:
        detail = "invoice exceeds the 5 MiB, 10-page, or 20-megapixel upload limit"
        raise HTTPException(413, detail) from exc
    except ValueError as exc:
        raise HTTPException(415, str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(503, "invoice validation is busy; retry shortly") from exc
    safe_name = (file.filename or "invoice-upload").replace("\\", "/").split("/")[-1]
    safe_name = "".join(ch for ch in safe_name[:120] if ch.isalnum() or ch in "._ -") or "invoice-upload"
    sample = sample_for_bytes(data, sample_id)
    fields = {key: None for key in ("invoice_number", "vendor_name", "amount_minor", "currency", "destination_account", "payment_instructions")}
    warnings: list[str] = []
    provider_status, model = "unavailable", None

    if settings.gemini_mode == "fixture":
        if sample is not None:
            fields = dict(sample["fields"])
            provider_status, model = "fixture", "synthetic-sample-v1"
        else:
            warnings.append("fixture_mode_supports_only_exact_synthetic_samples")
    elif settings.gemini_mode == "live":
        try:
            await service.reserve_model_use(owner_id)
            fields, warnings = await service.gemini.extract_invoice(data, mime_type)
            provider_status, model = "live", settings.gemini_model
        except HTTPException:
            raise
        except Exception:
            warnings.append("extraction_unavailable")
    else:
        warnings.append("gemini_extraction_not_configured")

    if fields["currency"] not in (None, "INR"):
        fields["currency"] = None
        fields["amount_minor"] = None
        warnings.append("unsupported_currency")
    for key, value in fields.items():
        if value is None:
            warnings.append(f"missing_{key}")
    return {"extraction_id": secrets.token_urlsafe(18), "provider_status": provider_status, "model": model,
            "filename": safe_name, "fields": fields, "warnings": list(dict.fromkeys(warnings)), "requires_review": True}


@app.post("/api/v1/assessments")
async def create_assessment(request: AssessmentRequest, session_id: str = Depends(require_session)):
    if settings.auth_mode == "access_code" and settings.access_code:
        with session_state_lock:
            session = session_counts.get(session_id)
            if session is None: raise HTTPException(401, "authenticated session expired")
            if session["count"] >= settings.max_assessments_per_session: raise HTTPException(429, "assessment limit reached for this session")
            session["count"] += 1
    elif settings.auth_mode == "firebase":
        try:
            async with asyncio.timeout(15):
                cases = await asyncio.to_thread(repository.list_cases, session_id, limit=settings.max_assessments_per_session)
            if len(cases) >= settings.max_assessments_per_session:
                raise HTTPException(429, "assessment limit reached for this visitor")
        except (RepositoryUnavailable, SQLAlchemyError) as exc:
            raise HTTPException(503, "assessment repository unavailable") from exc
        except TimeoutError as exc:
            raise HTTPException(503, "assessment repository timed out") from exc
    return await service.assess(request, session_id)


@app.get("/api/v1/assessments")
def list_assessments(session_id: str = Depends(require_session)):
    try: return {"assessments": repository.list_cases(session_id)}
    except Exception as exc: raise HTTPException(503, "assessment list unavailable") from exc


@app.get("/api/v1/assessments/{assessment_id}")
def get_assessment(assessment_id: str, session_id: str = Depends(require_session)):
    try: case = repository.get_case(assessment_id, session_id)
    except (RepositoryUnavailable, SQLAlchemyError) as exc: raise HTTPException(503, "assessment repository unavailable") from exc
    if case is None: raise HTTPException(404, "assessment not found")
    return case


@app.post("/api/v1/assessments/{assessment_id}/explanation")
async def explain_assessment(assessment_id: str, session_id: str = Depends(require_session)):
    if settings.auth_mode == "access_code" and settings.access_code:
        with session_state_lock:
            session = session_counts.get(session_id)
            if session is None: raise HTTPException(401, "authenticated session expired")
            if session["explanations"] >= settings.max_explanations_per_session: raise HTTPException(429, "explanation limit reached for this session")
            session["explanations"] += 1
    return await service.explain(assessment_id, session_id)


frontend_dist = Path(os.environ.get("FRONTEND_DIST", "frontend/dist"))
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
