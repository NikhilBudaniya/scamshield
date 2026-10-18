import asyncio
import time
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from .policy import decide, POLICY_VERSION
from .providers import GeminiProvider, JevProvider, fallback_explanation
from .repository import DuplicateRequest, Repository, RepositoryUnavailable
from .rules import evaluate_rules
from .schemas import AssessmentRequest

REPOSITORY_CALL_TIMEOUT_SECONDS = 15


class AssessmentService:
    def __init__(self, repository: Repository, jev: JevProvider, gemini: GeminiProvider):
        self.repository, self.jev, self.gemini = repository, jev, gemini
        self.explanation_locks: dict[str, asyncio.Lock] = {}
        self.provider_budget = ProcessProviderBudget(gemini.settings.max_provider_calls_per_process)

    async def reserve_model_use(self, owner_session_id: str):
        """Reserve before each live Gemini call; Firestore reservations survive restarts."""
        if hasattr(self.repository, "reserve_model_usage"):
            from .firestore_repository import ModelQuotaExceeded
            try:
                async with asyncio.timeout(REPOSITORY_CALL_TIMEOUT_SECONDS):
                    await asyncio.to_thread(
                        self.repository.reserve_model_usage,
                        owner_session_id,
                        per_user_limit=self.gemini.settings.daily_model_limit_per_user,
                        global_limit=self.gemini.settings.daily_model_limit_global,
                        total_limit=self.gemini.settings.total_model_limit_global,
                    )
            except ModelQuotaExceeded as exc:
                raise HTTPException(429, "model request limit reached") from exc
            except RepositoryUnavailable as exc:
                raise HTTPException(503, "model quota service unavailable") from exc
            except TimeoutError as exc:
                raise HTTPException(503, "model quota service timed out") from exc
        else:
            await self.provider_budget.reserve()

    async def _repository_call(self, method, *args, **kwargs):
        try:
            async with asyncio.timeout(REPOSITORY_CALL_TIMEOUT_SECONDS):
                return await asyncio.to_thread(method, *args, **kwargs)
        except TimeoutError as exc:
            raise HTTPException(503, "assessment repository timed out") from exc

    async def assess(self, request: AssessmentRequest, owner_session_id: str = "local-unprotected"):
        start = time.perf_counter()
        request_data = request.model_dump(mode="json")
        request_hash = self.repository.request_hash(request_data)
        try:
            old, old_hash = await self._repository_call(self.repository.find_by_client_id, owner_session_id, request.client_request_id)
        except (SQLAlchemyError, RepositoryUnavailable) as exc:
            raise HTTPException(503, "assessment repository unavailable") from exc
        if old:
            if old_hash != request_hash: raise HTTPException(409, "client_request_id was already used with different request data")
            return old
        rules_start = time.perf_counter()
        signals, missing = evaluate_rules(request)
        rules_ms = (time.perf_counter() - rules_start) * 1000
        class_start = time.perf_counter()
        classifier_is_gemini = self.gemini.settings.context_provider == "gemini"
        classifier_settings = self.gemini.settings if classifier_is_gemini else getattr(self.jev, "settings", self.gemini.settings)
        live_classifier = (
            classifier_settings.gemini_mode == "live"
            if classifier_is_gemini
            else getattr(classifier_settings, "jev_mode", "fixture") == "live"
        )
        if request.context is not None and live_classifier:
            await self.reserve_model_use(owner_session_id)
        classification = await (self.gemini.classify_context(request) if classifier_is_gemini else self.jev.classify(request))
        classification_ms = (time.perf_counter() - class_start) * 1000
        signals.extend(classification.signals)
        if request.context is None:
            missing.append("context_classification_not_requested")
        elif classification.status == "unavailable":
            missing.append("context_classification_unavailable")
        recommendation, degraded = decide(signals, request.context is not None, classification.status in ("live", "fixture", "not_requested"))
        if degraded and degraded not in missing: missing.append(degraded)
        case = {
            "assessment_id": str(uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), "schema_version": "1.0", "policy_version": POLICY_VERSION,
            "request": request_data, "recommendation": recommendation, "signals": signals, "missing_data": list(dict.fromkeys(missing)),
            "provider_status": {"jev": "not_requested" if classifier_is_gemini else classification.status, "gemini": "not_requested", "gemini_classifier": classification.status if classifier_is_gemini else "not_requested"}, "explanation_status": "pending", "explanation": None,
            "provider_models": {"jev": classification.model if not classifier_is_gemini and classification.status == "live" else None, "gemini_classifier": classification.model if classifier_is_gemini and classification.status == "live" else None, "gemini_explanation": None},
            "timings_ms": {"decision": 0.0, "rules": round(rules_ms, 3), "classification": round(classification_ms, 3), "explanation": None},
        }
        try:
            await self._repository_call(self.repository.save_case, case, request_hash, owner_session_id)
        except (IntegrityError, DuplicateRequest):
            try:
                existing, existing_hash = await self._repository_call(self.repository.find_by_client_id, owner_session_id, request.client_request_id)
            except (SQLAlchemyError, RepositoryUnavailable) as exc:
                raise HTTPException(503, "assessment repository unavailable") from exc
            if existing:
                if existing_hash != request_hash: raise HTTPException(409, "client_request_id was already used with different request data")
                return existing
            raise HTTPException(503, "assessment could not be saved")
        except (SQLAlchemyError, RepositoryUnavailable) as exc:
            raise HTTPException(503, "assessment could not be saved") from exc
        case["timings_ms"]["decision"] = round((time.perf_counter() - start) * 1000, 3)
        try:
            if not await self._repository_call(self.repository.update_case, case["assessment_id"], case, owner_session_id):
                raise HTTPException(503, "assessment timing could not be saved")
        except (SQLAlchemyError, RepositoryUnavailable) as exc:
            raise HTTPException(503, "assessment timing could not be saved") from exc
        return case

    async def explain(self, case_id: str, owner_session_id: str = "local-unprotected"):
        lock = self.explanation_locks.setdefault(case_id, asyncio.Lock())
        async with lock:
            try:
                case = await self._repository_call(self.repository.get_case, case_id, owner_session_id)
            except (SQLAlchemyError, RepositoryUnavailable) as exc:
                raise HTTPException(503, "assessment repository unavailable") from exc
            if case is None: raise HTTPException(404, "assessment not found")
            if case["explanation"] is not None: return case
            start = time.perf_counter()
            if self.gemini.settings.gemini_mode == "live":
                await self.reserve_model_use(owner_session_id)
            try:
                mode, explanation = await self.gemini.explain(case)
                case["provider_status"]["gemini"] = mode
                case["provider_models"]["gemini_explanation"] = self.gemini.settings.gemini_model if mode == "live" else None
                case["explanation_source"] = "gemini_prioritized_recorded_evidence" if mode == "live" else "deterministic_fixture"
                case["explanation_status"] = "ready"
            except Exception as exc:
                case["provider_status"]["gemini"] = "unavailable"
                case["explanation_status"] = "fallback"
                case["explanation_source"] = "deterministic_fallback"
                explanation = fallback_explanation(case)
                case["missing_data"].append("gemini_explanation_unavailable")
            case["explanation"] = explanation.model_dump()
            case["timings_ms"]["explanation"] = round((time.perf_counter() - start) * 1000, 3)
            try:
                if not await self._repository_call(self.repository.update_case, case_id, case, owner_session_id): raise HTTPException(404, "assessment not found")
            except (SQLAlchemyError, RepositoryUnavailable) as exc:
                raise HTTPException(503, "explanation could not be saved") from exc
            return case


class ProcessProviderBudget:
    """Concurrency-safe budget for live provider attempts in this process."""
    def __init__(self, limit: int):
        self.limit = limit
        self.used = 0
        self._lock = asyncio.Lock()

    async def reserve(self):
        async with self._lock:
            if self.used >= self.limit:
                raise HTTPException(429, "live provider request budget reached for this process")
            self.used += 1
