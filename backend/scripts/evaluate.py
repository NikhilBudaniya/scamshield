#!/usr/bin/env python3
"""Report deterministic fixture policy regression; this is not Jev accuracy or production validation."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.evaluation import examples
from app.policy import decide
from app.rules import evaluate_rules
from app.schemas import AssessmentRequest


def run(rows):
    results = []
    for item in rows:
        normalized = AssessmentRequest.model_validate(item["request"])
        rules, missing = evaluate_rules(normalized)
        context = normalized.context is not None
        fixture_findings = [{"code": code, "source": "curated_fixture_classification", "value": True, "evidence_ids": [normalized.context.evidence_id], "probability": .9 if item["label"] == "suspicious" else .72} for code in item["contextual_findings"]] if context and item["provider_mode"] == "fixture" else []
        rules_only, _ = decide(rules, False, True)
        plus, _ = decide(rules + fixture_findings, context, item["provider_mode"] != "unavailable")
        results.append({**item, "rule_signals": rules, "missing_data": missing, "rules_only": rules_only, "rules_plus_fixture": plus, "contextual_provider": item["provider_mode"]})
    return results


def summarize(rows):
    def ratio(n, d): return round(n / d, 3) if d else None
    suspicious = [r for r in rows if r["label"] == "suspicious"]
    legitimate = [r for r in rows if r["label"] == "legitimate"]
    ambiguous = [r for r in rows if r["label"] == "ambiguous"]
    failures = sum(r["contextual_provider"] == "unavailable" for r in rows)
    incremental = sum(r["rules_only"] == "continue" and r["rules_plus_fixture"] in ("verify", "review") for r in suspicious)
    return {
        "example_count": len(rows), "workflow_counts": {key: sum(r["workflow"] == key for r in rows) for key in ("consumer_transfer", "invoice_payment")},
        "fixture_intervention_rate_on_labeled_suspicious": ratio(sum(r["rules_plus_fixture"] in ("verify", "review") for r in suspicious), len(suspicious)),
        "fixture_intervention_rate_on_labeled_legitimate": ratio(sum(r["rules_plus_fixture"] in ("verify", "review") for r in legitimate), len(legitimate)),
        "fixture_ambiguous_verify_rate": ratio(sum(r["rules_plus_fixture"] == "verify" for r in ambiguous), len(ambiguous)),
        "fixture_provider_failures": failures, "incremental_fixture_detections_over_rules_only": incremental,
        "warning": "Curated fixture outputs exercise policy behavior only. These rates are not model accuracy, fraud recall, or production performance.",
    }


if __name__ == "__main__":
    data = run(examples())
    print(json.dumps({"mode": "fixture_policy_regression", "development": summarize([x for x in data if x["split"] == "development"]), "heldout": summarize([x for x in data if x["split"] == "heldout"]), "rows": data}, indent=2))
