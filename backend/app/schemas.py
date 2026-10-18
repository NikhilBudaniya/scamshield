from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Context(StrictModel):
    text: str = Field(min_length=1, max_length=8000)
    source: str = Field(min_length=1, max_length=40)
    evidence_id: str = Field(min_length=1, max_length=120)


class Recipient(StrictModel):
    identifier: str = Field(min_length=1, max_length=255)
    display_name: str | None = Field(default=None, max_length=160)


class AssessmentRequest(StrictModel):
    client_request_id: str = Field(min_length=1, max_length=120)
    payment_method: Literal["upi", "bank_transfer"]
    use_case: Literal["consumer_transfer", "invoice_payment"]
    amount_minor: int = Field(gt=0, le=10**15)
    currency: Literal["INR"]
    occurred_at: datetime
    customer_id: str = Field(min_length=1, max_length=120)
    recipient: Recipient
    context: Context | None = None
    method_details: dict[str, Any]
    scenario_id: str | None = Field(default=None, max_length=80)

    @field_validator("occurred_at", mode="before")
    @classmethod
    def parse_datetime_string(cls, value):
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ValueError("occurred_at must be an ISO-8601 timestamp") from exc
        return value

    @field_validator("occurred_at")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def validate_adapter_fields(self):
        details = self.method_details
        if self.use_case == "consumer_transfer":
            if self.payment_method != "upi":
                raise ValueError("consumer_transfer requires payment_method upi")
            if set(details) != {"upi_address"} or not isinstance(details.get("upi_address"), str) or not details["upi_address"].strip() or len(details["upi_address"]) > 254:
                raise ValueError("consumer_transfer requires method_details.upi_address")
            if details["upi_address"].strip().casefold() != self.recipient.identifier.casefold():
                raise ValueError("recipient identifier must match upi_address")
        else:
            if self.payment_method != "bank_transfer":
                raise ValueError("invoice_payment requires payment_method bank_transfer")
            required = {"vendor_id", "invoice_number", "destination_account"}
            if set(details) != required or any(not isinstance(details.get(k), str) or not details[k].strip() or len(details[k]) > 120 for k in required):
                raise ValueError("invoice_payment requires vendor_id, invoice_number, and destination_account")
            if self.recipient.identifier != details["vendor_id"]:
                raise ValueError("invoice recipient identifier must match method_details.vendor_id")
        return self


class Explanation(BaseModel):
    summary: str
    next_step: str
    analyst_summary: str


class Signal(BaseModel):
    code: str
    source: str
    value: Any
    evidence_ids: list[str] = Field(default_factory=list)
    probability: float | None = Field(default=None, ge=0, le=1)


class ProviderStatus(BaseModel):
    jev: Literal["live", "fixture", "unavailable", "not_requested"]
    gemini: Literal["live", "fixture", "unavailable", "not_requested"]
    gemini_classifier: Literal["live", "fixture", "unavailable", "not_requested"] = "not_requested"


class Timings(BaseModel):
    decision: float
    rules: float
    classification: float
    explanation: float | None = None


class AssessmentCase(BaseModel):
    assessment_id: str
    created_at: datetime
    schema_version: str
    policy_version: str
    request: AssessmentRequest
    recommendation: Literal["continue", "verify", "review"]
    signals: list[Signal]
    missing_data: list[str]
    provider_status: ProviderStatus
    explanation_status: Literal["pending", "ready", "fallback"]
    explanation: Explanation | None
    timings_ms: Timings
