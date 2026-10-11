POLICY_VERSION = "demo-policy-1.0"
CONTEXT_CODES = {"impersonation", "safe_account", "urgency", "secrecy", "upfront_fee", "bypass_verification"}


def decide(signals, context_requested: bool, classification_ok: bool):
    by_code = {s["code"]: s for s in signals}
    review = "changed_vendor_account" in by_code
    if by_code.get("safe_account", {}).get("probability", 0) >= 0.8 and "new_recipient" in by_code:
        review = True
    pairs = (("impersonation", "secrecy"), ("impersonation", "bypass_verification"), ("upfront_fee", "bypass_verification"))
    if any(all(by_code.get(code, {}).get("probability", 0) >= 0.8 for code in pair) for pair in pairs):
        review = True
    if review:
        return "review", None
    contextual = [s for s in signals if s["code"] in CONTEXT_CODES and (s.get("probability") or 0) >= 0.6]
    if contextual or any(c in by_code for c in ("new_recipient", "unusual_amount", "high_frequency")):
        return "verify", None
    if context_requested and not classification_ok:
        return "verify", "context_classification_unavailable"
    return "continue", None
