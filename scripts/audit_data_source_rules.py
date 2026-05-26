#!/usr/bin/env python3
"""Audit mddb.dev data-source role invariants.

This script codifies the source-role rules in docs/data-source-rules.md:
- OpenRouter, LiteLLM, Bailian, and Volcengine may all back canonical models.
- USD-priced sources do not have higher authority than CNY-priced sources.
- models.dev is icon/logo enrichment only, not a canonical model source.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

CANONICAL_MODEL_SOURCES = {
    "openrouter",
    "litellm",
    "bailian_model_market",
    "volcengine_ark",
}
MODELS_DEV = "models.dev"
ROUTER_PRODUCT_IDS = {
    "auto",
    "bodybuilder",
    "free",
    "owl-alpha",
    "pareto-code",
    "router",
}
DOC_REQUIRED_PHRASES = [
    "USD 来源不天然高于 CNY 来源",
    "models.dev",
    "不作为 canonical model 来源",
    "百炼",
    "火山引擎",
]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def source_names(model: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    for source in as_list(model.get("sources")):
        if isinstance(source, dict) and isinstance(source.get("source"), str):
            names.add(source["source"])
    for price in as_list(model.get("prices")):
        if isinstance(price, dict) and isinstance(price.get("source"), str):
            names.add(price["source"])
    return names


def has_models_dev_icon_enrichment(model: dict[str, Any]) -> bool:
    icon = model.get("icon")
    raw_params = model.get("other_parameters")
    params = raw_params if isinstance(raw_params, dict) else {}
    raw_models_dev = params.get("models_dev")
    models_dev = raw_models_dev if isinstance(raw_models_dev, dict) else {}
    remote_icon = models_dev.get("remote_icon")
    return bool(icon or remote_icon)


def audit_docs(root: Path) -> list[str]:
    errors: list[str] = []
    doc_path = root / "docs" / "data-source-rules.md"
    if not doc_path.exists():
        return [f"missing required doc: {doc_path}"]
    text = doc_path.read_text(encoding="utf-8")
    for phrase in DOC_REQUIRED_PHRASES:
        if phrase not in text:
            errors.append(f"docs/data-source-rules.md missing required phrase: {phrase}")
    return errors


def audit_models(root: Path) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    warnings: list[str] = []
    models_path = root / "data" / "models.json"
    payload = load_json(models_path)
    models = as_list(payload.get("models"))
    ids = [str(model.get("id", "")) for model in models if isinstance(model, dict)]
    id_counts = Counter(ids)
    duplicate_ids = sorted([model_id for model_id, count in id_counts.items() if model_id and count > 1])
    if duplicate_ids:
        errors.append(f"duplicate canonical model ids: {duplicate_ids[:20]}")

    source_counts: Counter[str] = Counter()
    models_dev_canonical: list[str] = []
    router_products: list[str] = []
    free_price_facts: list[str] = []

    for model in models:
        if not isinstance(model, dict):
            continue
        model_id = str(model.get("id", ""))
        if model_id in ROUTER_PRODUCT_IDS:
            router_products.append(model_id)
        names = source_names(model)
        for name in names:
            source_counts[name] += 1
        if MODELS_DEV in names and not has_models_dev_icon_enrichment(model):
            models_dev_canonical.append(model_id)
        if names and names.issubset({MODELS_DEV}):
            models_dev_canonical.append(model_id)
        for price in as_list(model.get("prices")):
            if not isinstance(price, dict):
                continue
            if ":free" in str(price.get("source_id", "")).lower() or ":free" in str(price.get("endpoint", {})).lower():
                free_price_facts.append(model_id)

    if models_dev_canonical:
        errors.append(
            "models.dev appears to be a canonical model source instead of icon enrichment: "
            + ", ".join(sorted(set(models_dev_canonical))[:20])
        )
    if router_products:
        errors.append(f"router/product ids remain canonical models: {sorted(set(router_products))}")
    if free_price_facts:
        warnings.append(f"possible free-tier price facts: {sorted(set(free_price_facts))[:20]}")

    for required in CANONICAL_MODEL_SOURCES:
        if source_counts[required] == 0:
            warnings.append(f"no canonical models currently backed by {required}")

    return errors, {
        "model_count": len(models),
        "source_counts": {source: source_counts[source] for source in sorted(source_counts)},
        "warnings": warnings,
    }


def audit_provider_offers(root: Path, fix: bool = False) -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    models = as_list(load_json(root / "data" / "models.json").get("models"))
    model_ids = {str(model.get("id")) for model in models if isinstance(model, dict) and model.get("id")}
    providers_dir = root / "data" / "providers"
    provider_files = sorted(providers_dir.glob("*.json")) if providers_dir.exists() else []
    dangling: list[str] = []
    duplicate_keys: list[str] = []
    models_dev_price_offers: list[str] = []
    removed_models_dev_offers = 0
    stripped_models_dev_offer_facts = 0
    offer_count = 0

    for path in provider_files:
        provider = load_json(path)
        provider_id = str(provider.get("id") or path.stem)
        seen: set[str] = set()
        changed = False
        cleaned_offers: list[Any] = []
        for offer in as_list(provider.get("offers")):
            if not isinstance(offer, dict):
                cleaned_offers.append(offer)
                continue
            offer = dict(offer)
            offer_count += 1
            model_id = str(offer.get("model_id", ""))
            if model_id not in model_ids:
                dangling.append(f"{provider_id}:{model_id}")
            key = "|".join(str(offer.get(part, "")) for part in ("model_id", "api_model_id", "endpoint_path"))
            if key in seen:
                duplicate_keys.append(f"{provider_id}:{key}")
            seen.add(key)
            source_names_in_offer = {
                str(source.get("source"))
                for source in as_list(offer.get("sources"))
                if isinstance(source, dict) and source.get("source")
            }
            price_sources = {
                str(price.get("source"))
                for price in as_list(offer.get("prices"))
                if isinstance(price, dict) and price.get("source")
            }
            has_models_dev_price_or_only_offer = MODELS_DEV in price_sources or (
                source_names_in_offer == {MODELS_DEV} and as_list(offer.get("prices"))
            )
            if has_models_dev_price_or_only_offer:
                models_dev_price_offers.append(f"{provider_id}:{model_id}")
            if fix:
                original_offer = json.dumps(offer, sort_keys=True, ensure_ascii=False)
                offer["sources"] = [
                    source for source in as_list(offer.get("sources"))
                    if not (isinstance(source, dict) and source.get("source") == MODELS_DEV)
                ]
                offer["prices"] = [
                    price for price in as_list(offer.get("prices"))
                    if not (isinstance(price, dict) and price.get("source") == MODELS_DEV)
                ]
                params = offer.get("other_parameters")
                if isinstance(params, dict) and params.get("source") == MODELS_DEV:
                    params = {key: value for key, value in params.items() if key not in {"source", "match"}}
                    if params:
                        offer["other_parameters"] = params
                    else:
                        offer.pop("other_parameters", None)
                no_sources = len(as_list(offer.get("sources"))) == 0
                no_prices = len(as_list(offer.get("prices"))) == 0
                no_meaningful_params = not offer.get("other_parameters")
                if source_names_in_offer == {MODELS_DEV} and no_sources and no_prices and no_meaningful_params:
                    removed_models_dev_offers += 1
                    changed = True
                    continue
                if json.dumps(offer, sort_keys=True, ensure_ascii=False) != original_offer:
                    stripped_models_dev_offer_facts += 1
                    changed = True
            cleaned_offers.append(offer)
        if fix and changed:
            provider["offers"] = cleaned_offers
            with path.open("w", encoding="utf-8") as fh:
                json.dump(provider, fh, ensure_ascii=False, indent=2)
                fh.write("\n")

    if dangling:
        errors.append(f"provider offers point to missing canonical models: {dangling[:30]}")
    if duplicate_keys:
        errors.append(f"duplicate provider offer keys: {duplicate_keys[:30]}")
    if models_dev_price_offers and not fix:
        errors.append(
            "models.dev offer/pricing facts found; models.dev must be icon-only: "
            + ", ".join(sorted(set(models_dev_price_offers))[:30])
        )

    return errors, {
        "provider_count": len(provider_files),
        "offer_count": offer_count,
        "models_dev_offer_price_violations": len(set(models_dev_price_offers)),
        "removed_models_dev_offers": removed_models_dev_offers,
        "stripped_models_dev_offer_facts": stripped_models_dev_offer_facts,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root")
    parser.add_argument("--json", action="store_true", help="print machine-readable summary")
    parser.add_argument("--fix", action="store_true", help="remove models.dev offer/pricing facts so models.dev remains icon-only")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    errors: list[str] = []
    summary: dict[str, Any] = {}

    doc_errors = audit_docs(root)
    model_errors, model_summary = audit_models(root)
    provider_errors, provider_summary = audit_provider_offers(root, fix=args.fix)
    errors.extend(doc_errors)
    errors.extend(model_errors)
    errors.extend(provider_errors)
    summary.update(model_summary)
    summary.update(provider_summary)
    summary["errors"] = errors

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print("mddb data-source rule audit")
        print(f"models: {summary['model_count']}")
        print(f"providers: {summary['provider_count']}")
        print(f"offers: {summary['offer_count']}")
        print("source_counts:")
        for source, count in summary["source_counts"].items():
            print(f"  {source}: {count}")
        for warning in summary.get("warnings", []):
            print(f"WARNING: {warning}", file=sys.stderr)
        if errors:
            print("errors:", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print("ok")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
