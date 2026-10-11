from datetime import datetime, timedelta, timezone

DEMO_TIME = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)


def _request(client_id, method, case, amount, customer, recipient, ctx, details, scenario):
    return {
        "client_request_id": client_id,
        "payment_method": method,
        "use_case": case,
        "amount_minor": amount,
        "currency": "INR",
        "occurred_at": DEMO_TIME.isoformat(),
        "customer_id": customer,
        "recipient": {"identifier": recipient, "display_name": recipient},
        "context": ({"text": ctx, "source": "message", "evidence_id": f"{scenario}-message"} if ctx else None),
        "method_details": details,
        "scenario_id": scenario,
    }


SCENARIOS = [
    {"id": "safe-account", "title": "Fake bank safe-account request", "description": "New UPI recipient with a request to move money to a safe account.", "expected_recommendation": "review", "request": _request("demo-safe-account", "upi", "consumer_transfer", 2500000, "customer-asha", "reserve@upi", "Move your money to a safe account now. Do not call the bank; I am handling this urgently.", {"upi_address": "reserve@upi"}, "safe-account")},
    {"id": "large-legitimate", "title": "Legitimate large consumer payment", "description": "Large amount to a known recipient; no scam accusation should be made.", "expected_recommendation": "verify", "request": _request("demo-large-legitimate", "upi", "consumer_transfer", 9000000, "customer-asha", "homebuilder@upi", "Final payment for the renovation as agreed.", {"upi_address": "homebuilder@upi"}, "large-legitimate")},
    {"id": "urgent-family", "title": "Urgent ambiguous family request", "description": "Urgent request to pay a new recipient without strong impersonation evidence.", "expected_recommendation": "verify", "request": _request("demo-urgent-family", "upi", "consumer_transfer", 180000, "customer-asha", "cousin-new@upi", "Please send this quickly, I will explain when I get home.", {"upi_address": "cousin-new@upi"}, "urgent-family")},
    {"id": "changed-vendor-account", "title": "Invoice with changed bank details", "description": "Payment instructions use a destination different from the saved vendor destination.", "expected_recommendation": "review", "request": _request("demo-changed-vendor", "bank_transfer", "invoice_payment", 12500000, "business-acme", "vendor-acme", "Our bank account has changed. Please use the new details below and bypass your usual callback verification.", {"vendor_id": "vendor-acme", "invoice_number": "INV-2048", "destination_account": "IN99-NEW-8891"}, "changed-vendor-account")},
    {"id": "repeat-vendor", "title": "Normal repeat vendor invoice", "description": "Repeat invoice to the saved destination with ordinary payment context.", "expected_recommendation": "continue", "request": _request("demo-repeat-vendor", "bank_transfer", "invoice_payment", 250000, "business-acme", "vendor-acme", "Invoice INV-2049 is due on the agreed date. Thank you.", {"vendor_id": "vendor-acme", "invoice_number": "INV-2049", "destination_account": "IN88-ACME-2200"}, "repeat-vendor")},
    {"id": "provider-timeout", "title": "Context provider timeout", "description": "Suspicious-looking context with fixture output unavailable, so degraded policy verifies.", "expected_recommendation": "verify", "request": _request("demo-provider-timeout", "upi", "consumer_transfer", 50000, "customer-asha", "unknown-timeout@upi", "Please keep this secret and transfer the fee before the account can be released.", {"upi_address": "unknown-timeout@upi"}, "provider-timeout")},
]

# These are synthetic records used only by the two demo profiles.
KNOWN_RECIPIENTS = {
    "customer-asha": {"homebuilder@upi", "grocery@upi", "family@upi"},
}
HISTORY = {
    "customer-asha": [
        {"amount_minor": 300000, "currency": "INR", "recipient": "homebuilder@upi", "occurred_at": DEMO_TIME - timedelta(days=18)},
        {"amount_minor": 450000, "currency": "INR", "recipient": "homebuilder@upi", "occurred_at": DEMO_TIME - timedelta(days=13)},
        {"amount_minor": 250000, "currency": "INR", "recipient": "homebuilder@upi", "occurred_at": DEMO_TIME - timedelta(days=9)},
        {"amount_minor": 50000, "currency": "INR", "recipient": "grocery@upi", "occurred_at": DEMO_TIME - timedelta(minutes=3)},
        {"amount_minor": 40000, "currency": "INR", "recipient": "family@upi", "occurred_at": DEMO_TIME - timedelta(minutes=6)},
        {"amount_minor": 60000, "currency": "INR", "recipient": "grocery@upi", "occurred_at": DEMO_TIME - timedelta(minutes=8)},
        {"amount_minor": 45000, "currency": "INR", "recipient": "grocery@upi", "occurred_at": DEMO_TIME - timedelta(days=2)},
        {"amount_minor": 50000, "currency": "INR", "recipient": "family@upi", "occurred_at": DEMO_TIME - timedelta(days=3)},
        {"amount_minor": 55000, "currency": "INR", "recipient": "family@upi", "occurred_at": DEMO_TIME - timedelta(days=7)},
        {"amount_minor": 52000, "currency": "INR", "recipient": "family@upi", "occurred_at": DEMO_TIME - timedelta(days=10)},
    ]
}
VENDORS = {"vendor-acme": {"business_id": "business-acme", "destination_account": "IN88-ACME-2200"}}
