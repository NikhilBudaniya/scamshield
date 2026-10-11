import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path
from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import get_settings
from .providers import GeminiProvider, JevProvider
from .repository import Repository
from .schemas import AssessmentRequest
from .service import AssessmentService

settings = get_settings()
repository = Repository(settings.database_url)
service = AssessmentService(repository, JevProvider(settings), GeminiProvider(settings))
app = FastAPI(title="ScamShield API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[], allow_methods=["GET", "POST"], allow_headers=["Content-Type"], allow_credentials=True)
session_counts: dict[str, dict] = {}
login_attempts: dict[str, list[float]] = {}


@app.on_event("startup")
def startup():
    if settings.context_provider not in {"jev", "gemini"}:
        raise RuntimeError("CONTEXT_PROVIDER must be jev or gemini")
    if settings.access_code and (settings.session_secret == "local-demo-secret-change-me" or len(settings.session_secret) < 32):
        raise RuntimeError("Protected sessions require SESSION_SECRET with at least 32 characters")
    is_managed = bool(os.environ.get("K_SERVICE")) or settings.environment.casefold() == "production"
    if settings.access_code and not settings.cookie_secure and (is_managed or not settings.local_development):
        raise RuntimeError("Protected sessions require COOKIE_SECURE=true, or explicit LOCAL_DEVELOPMENT=true for local HTTP")
    live_context = (settings.context_provider == "jev" and settings.jev_mode == "live") or (settings.context_provider == "gemini" and settings.gemini_mode == "live")
    if (live_context or settings.gemini_mode == "live") and not settings.access_code:
        raise RuntimeError("Live provider mode requires DEMO_ACCESS_CODE to prevent an unrestricted model proxy")
    repository.initialize()


def _token(session_id: str, expires_at: int) -> str:
    payload = f"{session_id}.{expires_at}"
    sig = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _session_id(token: str | None):
    if not settings.access_code: return "local-unprotected"
    now = time.time()
    for expired_id, session in list(session_counts.items()):
        if session["expires"] < now: session_counts.pop(expired_id, None)
    if not token or "." not in token: raise HTTPException(401, "authenticated session required")
    try: sid, expiration_text, sig = token.rsplit(".", 2); expiration = int(expiration_text)
    except (ValueError, TypeError): raise HTTPException(401, "authenticated session required")
    payload = f"{sid}.{expiration_text}"
    expected = hmac.new(settings.session_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if expiration < int(time.time()) or not hmac.compare_digest(sig, expected): raise HTTPException(401, "authenticated session required")
    session = session_counts.get(sid)
    if session is None or session["expires"] < time.time():
        session_counts.pop(sid, None)
        raise HTTPException(401, "authenticated session expired")
    return sid


def require_session(scamshield_session: str | None = Cookie(default=None)):
    return _session_id(scamshield_session)


@app.get("/api/health")
def health():
    return {"status": "ok", "provider_modes": {"jev": settings.jev_mode, "gemini": settings.gemini_mode, "context_provider": settings.context_provider}, "auth_required": bool(settings.access_code), "access_mode": "protected" if settings.access_code else "local_unprotected", "synthetic_data": True}


@app.post("/api/session")
def create_session(body: dict, response: Response, request: Request):
    if not settings.access_code:
        return {"authenticated": False, "access_mode": "local_unprotected"}
    now = time.time()
    for ip, attempts in list(login_attempts.items()):
        login_attempts[ip] = [when for when in attempts if now - when < 60]
        if not login_attempts[ip]: login_attempts.pop(ip, None)
    ip = request.client.host if request.client else "unknown"
    attempts = login_attempts.setdefault(ip, [])
    if len(attempts) >= settings.max_login_attempts_per_minute: raise HTTPException(429, "too many login attempts")
    if set(body) != {"access_code"} or not isinstance(body.get("access_code"), str) or not hmac.compare_digest(body["access_code"], settings.access_code):
        attempts.append(now)
        raise HTTPException(401, "invalid access code")
    sid = secrets.token_urlsafe(24)
    expiration = int(time.time()) + settings.session_ttl_seconds
    response.set_cookie("scamshield_session", _token(sid, expiration), httponly=True, secure=settings.cookie_secure, samesite="strict", max_age=settings.session_ttl_seconds, path="/")
    session_counts[sid] = {"count": 0, "explanations": 0, "expires": expiration}
    login_attempts.pop(ip, None)
    return {"authenticated": True, "access_mode": "protected", "expires_in_seconds": settings.session_ttl_seconds}


@app.get("/api/v1/scenarios")
def scenarios(session_id: str = Depends(require_session)):
    from .seed import SCENARIOS
    return {"scenarios": SCENARIOS}


@app.post("/api/v1/assessments")
async def create_assessment(request: AssessmentRequest, session_id: str = Depends(require_session)):
    if settings.access_code:
        count = session_counts[session_id]["count"]
        if count >= settings.max_assessments_per_session: raise HTTPException(429, "assessment limit reached for this session")
        session_counts[session_id]["count"] = count + 1
    return await service.assess(request)


@app.get("/api/v1/assessments")
def list_assessments(session_id: str = Depends(require_session)):
    try: return {"assessments": repository.list_cases()}
    except Exception as exc: raise HTTPException(503, "assessment list unavailable") from exc


@app.get("/api/v1/assessments/{assessment_id}")
def get_assessment(assessment_id: str, session_id: str = Depends(require_session)):
    case = repository.get_case(assessment_id)
    if case is None: raise HTTPException(404, "assessment not found")
    return case


@app.post("/api/v1/assessments/{assessment_id}/explanation")
async def explain_assessment(assessment_id: str, session_id: str = Depends(require_session)):
    if settings.access_code:
        session = session_counts[session_id]
        if session["explanations"] >= settings.max_explanations_per_session: raise HTTPException(429, "explanation limit reached for this session")
        session["explanations"] += 1
    return await service.explain(assessment_id)


frontend_dist = Path(os.environ.get("FRONTEND_DIST", "frontend/dist"))
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
