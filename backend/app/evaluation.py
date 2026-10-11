"""Curated deterministic policy regression corpus. Fixture outputs are not model accuracy."""

# Ten whole families per split, five for each workflow, with two held-together paraphrases.
FAMILIES = [
    ("safe_account_dev", "consumer_transfer", "suspicious", ["safe_account"], "Move funds to this protected reserve account immediately.", "Transfer to the bank safety account now; do not call."),
    ("impersonation_dev", "consumer_transfer", "suspicious", ["impersonation", "secrecy"], "I am from your bank; keep this transfer private.", "Your bank officer here. Do not tell anyone about this payment."),
    ("fee_bypass_dev", "consumer_transfer", "suspicious", ["upfront_fee", "bypass_verification"], "Pay this release fee and skip the usual callback.", "Transfer the processing charge first; no need to verify by phone."),
    ("urgent_dev", "consumer_transfer", "ambiguous", ["urgency"], "Please send this soon; I will explain later.", "Can you make the payment quickly? Details later."),
    ("repeat_dev", "consumer_transfer", "legitimate", [], "Payment for the agreed renovation milestone.", "Sending the agreed monthly payment to the saved recipient."),
    ("changed_vendor_dev", "invoice_payment", "suspicious", ["bypass_verification"], "Vendor bank details changed; skip callback verification.", "Please use our new account and bypass the usual verification."),
    ("invoice_impersonation_dev", "invoice_payment", "suspicious", ["impersonation", "bypass_verification"], "I am the vendor director; bypass callback and change the account.", "This is your supplier's CFO, use new bank details without a call."),
    ("ambiguous_invoice_dev", "invoice_payment", "ambiguous", ["urgency"], "Please process this vendor invoice today if possible.", "We need the invoice paid quickly; I can send more details later."),
    ("normal_invoice_dev", "invoice_payment", "legitimate", [], "Invoice due on the agreed date to our saved account.", "Please pay the routine invoice using our existing bank details."),
    ("missing_invoice_dev", "invoice_payment", "missing", [], "", ""),
    ("safe_account_holdout", "consumer_transfer", "suspicious", ["safe_account"], "Your balance is in danger; move it to our secure account today.", "Use this safe account to protect your money right away."),
    ("impersonation_holdout", "consumer_transfer", "suspicious", ["impersonation", "bypass_verification"], "This is the bank security team; do not verify by calling.", "I work for your bank. Avoid the normal confirmation and transfer now."),
    ("fee_bypass_holdout", "consumer_transfer", "suspicious", ["upfront_fee", "bypass_verification"], "Send the advance fee before release and bypass your normal check.", "Pay the deposit now and avoid the established verification step."),
    ("urgent_holdout", "consumer_transfer", "ambiguous", ["urgency"], "I need the transfer right away; will tell you more at home.", "Please pay now if you can; I cannot explain at the moment."),
    ("repeat_holdout", "consumer_transfer", "legitimate", [], "Here is the normal repeat payment we discussed.", "The usual family expense is due as planned."),
    ("changed_vendor_holdout", "invoice_payment", "suspicious", ["bypass_verification"], "Our invoice account was updated; no callback is needed.", "Pay the replacement bank destination without the normal check."),
    ("invoice_impersonation_holdout", "invoice_payment", "suspicious", ["impersonation", "bypass_verification"], "Vendor management here: override verification and update our account.", "I represent your supplier; skip confirmation and wire to this account."),
    ("ambiguous_invoice_holdout", "invoice_payment", "ambiguous", ["urgency"], "Could you process this invoice as soon as your team can?", "This vendor payment is time-sensitive; let me know when sent."),
    ("normal_invoice_holdout", "invoice_payment", "legitimate", [], "The regular monthly invoice is attached; details are unchanged.", "As agreed, this invoice uses the vendor account on file."),
    ("missing_invoice_holdout", "invoice_payment", "missing", [], "", ""),
]


def examples():
    rows = []
    from datetime import timedelta
    from .seed import DEMO_TIME
    for index, (family, workflow, label, codes, *texts) in enumerate(FAMILIES):
        split = "development" if index < 10 else "heldout"
        for variant, text in enumerate(texts):
            is_consumer = workflow == "consumer_transfer"
            destination = (f"new-{family}-{variant}@upi" if label in ("suspicious", "ambiguous") else "homebuilder@upi") if is_consumer else (f"IN99-{family}-{variant}" if family.startswith("changed_vendor") else "IN88-ACME-2200")
            details = {"upi_address": destination} if is_consumer else {"vendor_id": "vendor-acme", "invoice_number": f"EVAL-{index:02d}-{variant}", "destination_account": destination}
            context = None if not text else {"text": text, "source": "evaluation_message", "evidence_id": f"evidence-{family}-{variant}"}
            request = {
                "client_request_id": f"evaluation-{family}-{variant}", "payment_method": "upi" if is_consumer else "bank_transfer", "use_case": workflow,
                "amount_minor": 10000000 if family.startswith("fee_bypass") else 25000, "currency": "INR", "occurred_at": (DEMO_TIME + timedelta(days=2)).isoformat(),
                "customer_id": "customer-asha" if is_consumer else "business-acme", "recipient": {"identifier": destination if is_consumer else "vendor-acme", "display_name": "Synthetic recipient"},
                "context": context, "method_details": details, "scenario_id": family,
            }
            mode = "unavailable" if family == "ambiguous_invoice_dev" and variant == 1 else ("not_requested" if context is None else "fixture")
            rows.append({"id": f"{family}-{variant + 1}", "family": family, "split": split, "workflow": workflow, "label": label, "text": text, "contextual_findings": codes, "provider_mode": mode, "request": request})
    return rows
