from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app import main
from app.config import Settings
from app.firestore_repository import FirestoreRepository
from app.invoices import ASSET_DIR, SAMPLES, sample_for_bytes, validate_upload
from app.repository import Repository
from app.providers import GeminiProvider, JevProvider
from app.schemas import AssessmentRequest
from app.service import AssessmentService
from app.seed import SCENARIOS
from app.rules import evaluate_rules
from app.schemas import Context


def test_invoice_extraction_schema_converts_with_installed_google_genai_sdk():
    from google.genai import types
    from pydantic import ValidationError
    from app.providers import InvoiceExtractionFields

    converted = types.Schema.model_validate(InvoiceExtractionFields.model_json_schema())
    amount_schema = converted.properties["amount_minor"].any_of[0]
    assert amount_schema.minimum == 1
    assert amount_schema.maximum == 10**15
    with pytest.raises(ValidationError):
        InvoiceExtractionFields.model_validate({"amount_minor": 0})


def install_firestore_transaction_mock(monkeypatch):
    import sys
    import types
    module = types.ModuleType("google.cloud.firestore")
    module.transactional = lambda fn: (lambda transaction: fn(transaction))
    cloud = types.ModuleType("google.cloud")
    cloud.firestore = module
    monkeypatch.setitem(sys.modules, "google.cloud", cloud)
    monkeypatch.setitem(sys.modules, "google.cloud.firestore", module)
    return module


def test_public_config_has_client_firebase_values_only(monkeypatch):
    monkeypatch.setattr(main, "settings", Settings(auth_mode="firebase", firebase_api_key="public-key",
        firebase_auth_domain="demo.firebaseapp.com", firebase_app_id="app-id", firebase_project_id="demo"))
    response = TestClient(main.app).get("/api/config")
    assert response.status_code == 200
    assert response.json() == {"auth_mode": "firebase", "storage_mode": "sqlite", "synthetic_data": True,
        "firebase_config": {"apiKey": "public-key", "authDomain": "demo.firebaseapp.com", "projectId": "demo", "appId": "app-id"}}
    assert "gemini_api_key" not in response.text and "access_code" not in response.text


def test_firebase_auth_uses_verified_uid_and_rejects_invalid(monkeypatch):
    monkeypatch.setattr(main, "settings", Settings(auth_mode="firebase", firebase_api_key="k",
        firebase_auth_domain="demo.firebaseapp.com", firebase_app_id="app", firebase_project_id="demo"))
    seen = []
    monkeypatch.setattr(main, "verify_firebase_token", lambda token, project: seen.append((token, project)) or "verified-uid")
    assert main.require_session(authorization="Bearer opaque-id-token") == "verified-uid"
    assert seen == [("opaque-id-token", "demo")]
    client = TestClient(main.app)
    assert client.get("/api/v1/invoices/vendors").status_code == 401
    protected = client.get("/api/v1/invoices/vendors", headers={"Authorization": "Bearer opaque-id-token"})
    assert protected.status_code == 200
    assert protected.json()["vendors"][0] == {"vendor_id": "vendor-acme", "vendor_name": "Acme Supplies",
        "customer_id": "business-acme", "known_destination": "IN88-ACME-2200"}
    monkeypatch.setattr(main, "verify_firebase_token", lambda *_: (_ for _ in ()).throw(ValueError("invalid")))
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as error:
        main.require_session(authorization="Bearer bad-token")
    assert error.value.status_code == 401
    with pytest.raises(HTTPException):
        main.require_session(authorization="Bearer ")


def test_firebase_startup_requires_firestore_and_public_config_in_production(monkeypatch):
    import pytest
    monkeypatch.setenv("K_SERVICE", "scamshield")
    monkeypatch.setattr(main, "settings", Settings(auth_mode="firebase", firebase_api_key="k",
        firebase_auth_domain="demo.firebaseapp.com", firebase_app_id="app", firebase_project_id="demo",
        storage_backend="sqlite", environment="production", local_development=False))
    monkeypatch.setattr(main.repository, "initialize", lambda: None)
    with pytest.raises(RuntimeError, match="requires STORAGE_BACKEND=firestore"):
        main.startup()
    monkeypatch.setattr(main, "settings", Settings(auth_mode="firebase", firebase_api_key="k",
        firebase_auth_domain="demo.firebaseapp.com", firebase_app_id="app", firebase_project_id="demo",
        storage_backend="firestore", environment="production", local_development=False))
    main.startup()
    monkeypatch.setattr(main, "settings", Settings(auth_mode="firebase", firebase_project_id="demo",
        storage_backend="firestore", environment="production", local_development=False))
    with pytest.raises(RuntimeError, match="Firebase auth mode requires"):
        main.startup()


def test_sample_fixtures_are_bound_to_exact_bytes_and_named_id():
    for sample_id, sample in SAMPLES.items():
        data = (ASSET_DIR / sample["file"]).read_bytes()
        assert validate_upload(data, "application/pdf") == "application/pdf"
        assert sample_for_bytes(data, sample_id) == sample
        assert sample_for_bytes(data + b"edited", sample_id) is None
    assert sample_for_bytes((ASSET_DIR / SAMPLES["acme-repeat"]["file"]).read_bytes(), "acme-changed-account") is None


def _make_pdf(page_count: int, password: str | None = None) -> bytes:
    from io import BytesIO
    from pypdf import PdfWriter
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=100, height=100)
    if password:
        writer.encrypt(password)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_pdf_page_limit_and_malformed_or_encrypted_files_fail_closed():
    from app.invoices import MAX_INVOICE_PAGES
    assert validate_upload(_make_pdf(MAX_INVOICE_PAGES), "application/pdf") == "application/pdf"
    with pytest.raises(OverflowError, match="too_many_pdf_pages"):
        validate_upload(_make_pdf(MAX_INVOICE_PAGES + 1), "application/pdf")
    with pytest.raises(ValueError, match="malformed_pdf"):
        validate_upload(b"%PDF-1.4\nnot a real PDF", "application/pdf")
    with pytest.raises(ValueError, match="encrypted_pdf"):
        validate_upload(_make_pdf(1, password="secret"), "application/pdf")


def test_pdf_page_tree_rejects_repeated_references_without_expanding_pages():
    from io import BytesIO
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import ArrayObject, NameObject
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    pages = writer._pages.get_object()
    page_ref = pages[NameObject("/Kids")][0]
    pages[NameObject("/Kids")] = ArrayObject([page_ref] * 10_000)
    output = BytesIO()
    writer.write(output)
    reader = PdfReader(BytesIO(output.getvalue()), strict=True)
    from app.invoices import _count_pdf_pages_bounded
    with pytest.raises(ValueError, match="cyclic_or_repeated_pdf_page_tree_node"):
        _count_pdf_pages_bounded(reader)


def test_image_header_pixel_limits_reject_large_images_without_decoding():
    from app.invoices import MAX_IMAGE_PIXELS
    import struct
    png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" + struct.pack(">II", 100, 100) + b"\x08\x02\x00\x00\x00"
    assert validate_upload(png, "image/png") == "image/png"
    huge_png = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" + struct.pack(">II", MAX_IMAGE_PIXELS + 1, 1) + b"\x08\x02\x00\x00\x00"
    with pytest.raises(OverflowError, match="too_many_image_pixels"):
        validate_upload(huge_png, "image/png")


def test_invoice_upload_endpoint_fixture_and_validation(monkeypatch, tmp_path):
    repo = Repository(f"sqlite:///{tmp_path / 'invoice-test.db'}")
    repo.initialize()
    monkeypatch.setattr(main, "repository", repo)
    monkeypatch.setattr(main, "settings", Settings(gemini_mode="fixture", auth_mode="access_code"))
    client = TestClient(main.app)
    sample = SAMPLES["acme-repeat"]
    data = (ASSET_DIR / sample["file"]).read_bytes()
    response = client.post("/api/v1/invoices/extract", files={"file": (sample["filename"], data, "application/pdf")},
        data={"sample_id": sample["id"]})
    assert response.status_code == 200
    body = response.json()
    assert body["provider_status"] == "fixture" and body["requires_review"] is True
    assert body["fields"] == sample["fields"]
    assert "extraction_id" in body and "assessment_id" not in body
    assert repo.list_cases("local-unprotected") == []

    changed = client.post("/api/v1/invoices/extract", files={"file": (sample["filename"], data + b"x", "application/pdf")},
        data={"sample_id": sample["id"]})
    assert changed.status_code == 200
    assert changed.json()["provider_status"] == "unavailable"
    bad_mime = client.post("/api/v1/invoices/extract", files={"file": ("fake.pdf", data, "image/png")})
    assert bad_mime.status_code == 415
    oversized = client.post("/api/v1/invoices/extract", files={"file": ("large.pdf", b"%PDF-" + b"x" * (5 * 1024 * 1024), "application/pdf")})
    assert oversized.status_code == 413
    bad_sample = client.post("/api/v1/invoices/extract", files={"file": (sample["filename"], data, "application/pdf")},
        data={"sample_id": "acme-changed-account"})
    assert bad_sample.status_code == 200
    assert bad_sample.json()["provider_status"] == "unavailable"
    assert all(value is None for value in bad_sample.json()["fields"].values())


def test_oversized_pdf_is_rejected_before_reserving_or_calling_provider(monkeypatch):
    from unittest.mock import AsyncMock
    from app.invoices import MAX_INVOICE_PAGES
    monkeypatch.setattr(main, "settings", Settings(gemini_mode="live", auth_mode="access_code"))
    reserve = AsyncMock()
    extract = AsyncMock()
    monkeypatch.setattr(main.service, "reserve_model_use", reserve)
    monkeypatch.setattr(main.service.gemini, "extract_invoice", extract)
    client = TestClient(main.app)
    data = _make_pdf(MAX_INVOICE_PAGES + 1)
    response = client.post("/api/v1/invoices/extract", files={"file": ("long.pdf", data, "application/pdf")})
    assert response.status_code == 413
    assert reserve.await_count == 0
    assert extract.await_count == 0


def test_firestore_owner_paths_do_not_expose_raw_uid():
    class Ref:
        def __init__(self, identifier): self.id = identifier
        def collection(self, name): return Collection(name)
    class Collection:
        def __init__(self, name): self.name = name
        def document(self, identifier): return Ref(identifier)
    class FakeClient:
        def collection(self, name): return Collection(name)
    repo = FirestoreRepository(project_id="test-project", client=FakeClient())
    import hashlib
    assert repo._owner_ref("firebase-uid-1").id == hashlib.sha256(b"firebase-uid-1").hexdigest()
    assert repo._owner_ref("firebase-uid-2").id != repo._owner_ref("firebase-uid-1").id


def test_firestore_daily_model_limits_are_shared_and_durable(monkeypatch):
    from app.firestore_repository import ModelQuotaExceeded
    import pytest
    firestore = install_firestore_transaction_mock(monkeypatch)

    class Snapshot:
        def __init__(self, data): self._data = data; self.exists = data is not None
        def to_dict(self): return self._data
    class Ref:
        def __init__(self, client, path): self.client, self.path, self.id = client, path, path.rsplit("/", 1)[-1]
        def collection(self, name): return Collection(self.client, f"{self.path}/{name}")
        def document(self, identifier): return Ref(self.client, f"{self.path}/{identifier}")
        def get(self, transaction=None, **kwargs): return Snapshot(self.client.store.get(self.path))
    class Collection:
        def __init__(self, client, path): self.client, self.path = client, path
        def document(self, identifier): return Ref(self.client, f"{self.path}/{identifier}")
    class Transaction:
        def __init__(self, client): self.client = client
        def set(self, ref, data, merge=False):
            previous = self.client.store.get(ref.path, {}) if merge else {}
            self.client.store[ref.path] = {**previous, **data}
    class FakeClient:
        def __init__(self): self.store = {}
        def collection(self, name): return Collection(self, name)
        def transaction(self): return Transaction(self)
    monkeypatch.setattr(firestore, "transactional", lambda fn: (lambda transaction: fn(transaction)))
    client = FakeClient()
    repo = FirestoreRepository("demo", client=client)
    repo.reserve_model_usage("uid-one", per_user_limit=1, global_limit=2)
    with pytest.raises(ModelQuotaExceeded):
        repo.reserve_model_usage("uid-one", per_user_limit=1, global_limit=2)
    repo.reserve_model_usage("uid-two", per_user_limit=1, global_limit=2)
    with pytest.raises(ModelQuotaExceeded):
        repo.reserve_model_usage("uid-three", per_user_limit=1, global_limit=2)
    assert sum(value.get("count", 0) for path, value in client.store.items()
               if path.startswith("model_usage/202") and "/users/" not in path) == 2


def test_firestore_lifetime_model_cap_is_atomic_and_survives_day_changes(monkeypatch):
    from datetime import date, timedelta
    from app.firestore_repository import ModelQuotaExceeded
    firestore = install_firestore_transaction_mock(monkeypatch)

    class Snapshot:
        def __init__(self, data): self._data = data; self.exists = data is not None
        def to_dict(self): return self._data
    class Ref:
        def __init__(self, client, path): self.client, self.path = client, path
        def collection(self, name): return Collection(self.client, f"{self.path}/{name}")
        def document(self, identifier): return Ref(self.client, f"{self.path}/{identifier}")
        def get(self, transaction=None, **kwargs): return Snapshot(self.client.store.get(self.path))
    class Collection:
        def __init__(self, client, path): self.client, self.path = client, path
        def document(self, identifier): return Ref(self.client, f"{self.path}/{identifier}")
    class Transaction:
        def __init__(self, client): self.client = client
        def set(self, ref, data, merge=False):
            previous = self.client.store.get(ref.path, {}) if merge else {}
            self.client.store[ref.path] = {**previous, **data}
    class FakeClient:
        def __init__(self): self.store = {}
        def collection(self, name): return Collection(self, name)
        def transaction(self): return Transaction(self)
    monkeypatch.setattr(firestore, "transactional", lambda fn: (lambda transaction: fn(transaction)))
    client = FakeClient()
    repo = FirestoreRepository("demo", client=client)
    today = date(2026, 10, 18)
    repo.reserve_model_usage("uid-one", per_user_limit=9, global_limit=50, total_limit=1, today=today)
    with pytest.raises(ModelQuotaExceeded, match="model request limit"):
        repo.reserve_model_usage("uid-two", per_user_limit=9, global_limit=50, total_limit=1,
                                 today=today + timedelta(days=1))
    assert client.store["model_usage/lifetime"]["count"] == 1
    assert client.store[f"model_usage/{today.isoformat()}"]["count"] == 1
    assert f"model_usage/{(today + timedelta(days=1)).isoformat()}" not in client.store


def test_firestore_cases_and_idempotency_are_owner_scoped(monkeypatch):
    from app.repository import DuplicateRequest
    import pytest
    firestore = install_firestore_transaction_mock(monkeypatch)

    class Snapshot:
        def __init__(self, data): self._data = data; self.exists = data is not None
        def to_dict(self): return self._data
    class Ref:
        def __init__(self, client, path): self.client, self.path = client, path
        def collection(self, name): return Collection(self.client, f"{self.path}/{name}")
        def document(self, identifier): return Ref(self.client, f"{self.path}/{identifier}")
        def get(self, transaction=None, **kwargs): return Snapshot(self.client.store.get(self.path))
    class Collection:
        def __init__(self, client, path): self.client, self.path = client, path
        def document(self, identifier): return Ref(self.client, f"{self.path}/{identifier}")
    class Transaction:
        def __init__(self, client): self.client = client
        def create(self, ref, data):
            if ref.path in self.client.store: raise RuntimeError("already exists")
            self.client.store[ref.path] = data
    class FakeClient:
        def __init__(self): self.store = {}
        def collection(self, name): return Collection(self, name)
        def transaction(self): return Transaction(self)
    monkeypatch.setattr(firestore, "transactional", lambda fn: (lambda transaction: fn(transaction)))
    repo = FirestoreRepository("demo", client=FakeClient())
    case = {"assessment_id": "case-1", "created_at": "2026-10-18T12:00:00+00:00",
            "request": {"client_request_id": "retry-1"}, "recommendation": "verify"}
    repo.save_case(case, "hash-1", "verified-uid-a")
    assert repo.find_by_client_id("verified-uid-a", "retry-1") == (case, "hash-1")
    assert repo.find_by_client_id("verified-uid-b", "retry-1") == (None, None)
    assert repo.get_case("case-1", "verified-uid-b") is None
    assert repo.get_case("case-1", "verified-uid-a") == case
    with pytest.raises(DuplicateRequest):
        repo.save_case(case, "hash-1", "verified-uid-a")


@pytest.mark.asyncio
async def test_live_jev_classification_reserves_firestore_daily_model_budget(tmp_path):
    cfg = Settings(jev_mode="live", context_provider="jev", gemini_mode="fixture")
    repo = Repository(f"sqlite:///{tmp_path / 'jev-quota.db'}")
    repo.initialize()
    reservations = []
    def reserve(owner_id, *, per_user_limit, global_limit, total_limit):
        reservations.append((owner_id, per_user_limit, global_limit, total_limit))
    repo.reserve_model_usage = reserve
    service = AssessmentService(repo, JevProvider(cfg), GeminiProvider(cfg))
    request = AssessmentRequest.model_validate(SCENARIOS[0]["request"])
    await service.assess(request, "firebase-uid")
    assert reservations == [("firebase-uid", 9, 50, 200)]


@pytest.mark.asyncio
async def test_changed_invoice_sample_has_exact_fixture_and_vendor_history():
    request = AssessmentRequest.model_validate(SCENARIOS[3]["request"])
    sample_text = "Our bank account has changed; please bypass callback."
    request = request.model_copy(update={"context": Context(text=sample_text, source="invoice", evidence_id="sample-payment-instructions")})
    result = await JevProvider(Settings(jev_mode="fixture")).classify(request)
    assert result.status == "fixture"
    assert result.signals == [{"code": "bypass_verification", "source": "jev_classification", "value": True,
        "evidence_ids": ["sample-payment-instructions"], "probability": .98}]
    edited = request.model_copy(update={"context": Context(text=sample_text + "!", source="invoice", evidence_id="sample-payment-instructions")})
    assert (await JevProvider(Settings(jev_mode="fixture")).classify(edited)).status == "unavailable"
    signals, missing = evaluate_rules(request)
    assert "customer_payment_history" not in missing
    assert "changed_vendor_account" in {signal["code"] for signal in signals}
    repeat_request = AssessmentRequest.model_validate(SCENARIOS[4]["request"])
    repeat_request = repeat_request.model_copy(update={"context": Context(text="Payment due on invoice date.", source="invoice", evidence_id="sample-payment-instructions")})
    repeat_result = await JevProvider(Settings(jev_mode="fixture")).classify(repeat_request)
    assert repeat_result.status == "fixture" and repeat_result.signals == []
    _, repeat_missing = evaluate_rules(repeat_request)
    assert "customer_payment_history" not in repeat_missing
