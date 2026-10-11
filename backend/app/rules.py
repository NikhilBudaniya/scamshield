from statistics import median
from .seed import HISTORY, KNOWN_RECIPIENTS, VENDORS


def evaluate_rules(request):
    signals, missing = [], []
    history = HISTORY.get(request.customer_id)
    if history is None:
        missing.append("customer_payment_history")
    else:
        known = KNOWN_RECIPIENTS.get(request.customer_id, set())
        if request.use_case == "consumer_transfer" and request.recipient.identifier.casefold() not in {x.casefold() for x in known}:
            signals.append({"code": "new_recipient", "source": "transaction_rule", "value": {"recipient": request.recipient.identifier}, "evidence_ids": ["recipient", "customer_history"]})
        same_currency = [x["amount_minor"] for x in history if x["currency"] == request.currency]
        if len(same_currency) < 5:
            missing.append("insufficient_same_currency_history_for_amount")
        if len(same_currency) >= 5:
            med = median(same_currency)
            if request.amount_minor > med * 3:
                signals.append({"code": "unusual_amount", "source": "transaction_rule", "value": {"amount_minor": request.amount_minor, "historical_median_minor": med, "currency": request.currency, "history_count": len(same_currency)}, "evidence_ids": ["amount", "customer_history"]})
        recent = [x for x in history if x["currency"] == request.currency and 0 <= (request.occurred_at - x["occurred_at"]).total_seconds() <= 600]
        if len(recent) >= 3:
            signals.append({"code": "high_frequency", "source": "transaction_rule", "value": {"earlier_payments_10m": len(recent)}, "evidence_ids": ["occurred_at", "customer_history"]})
    if request.use_case == "invoice_payment":
        vendor = VENDORS.get(request.method_details["vendor_id"])
        if vendor is None:
            missing.append("vendor_destination_history")
        elif vendor["business_id"] != request.customer_id:
            missing.append("vendor_identity_mismatch")
        elif vendor["destination_account"].casefold() != request.method_details["destination_account"].casefold():
            signals.append({"code": "changed_vendor_account", "source": "vendor_record", "value": {"known_destination": vendor["destination_account"], "requested_destination": request.method_details["destination_account"]}, "evidence_ids": ["vendor_record", "method_details.destination_account"]})
    return signals, missing
