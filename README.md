# mddb.dev

mddb.dev is an open LLM model registry. It turns scattered model strings from providers, aggregators, pricing presets, and community data sources into a stable, provenance-aware model identity registry for humans and machines.

Public site: <https://mddb.dev/models/>

## Core principle

**Model identity comes first. Providers are observations, deployments, or distribution channels.**

The same underlying model can appear under many API routes, cloud marketplaces, gateway aliases, dated snapshots, pricing tables, and provider-specific spellings. mddb.dev tries to resolve those observations into one canonical model identity, while preserving the facts that differ as aliases, snapshots, variants, deployments, pricing facts, and source records.

## What the core asset is

The core asset is not just a rendered website and not just one raw JSON file. It is a canonical model identity graph with provenance.

In practice, the registry should answer:

- What is the stable canonical model tag?
- Which upstream strings, routes, aliases, and snapshots point to it?
- Which differences are meaningful variants rather than new models?
- Which providers, gateways, clouds, or regions serve it?
- What prices, context windows, modalities, limits, and capabilities have been observed?
- Which source supplied each fact, and when was it observed?
- Which candidate records are still waiting for manual review?

The website is one projection of that registry. Public machine-readable JSON exports are another projection.

## Current data sources

### OpenRouter

- Endpoint: `https://openrouter.ai/api/v1/models`
- Local snapshot: `data/openrouter-models.json`
- Refresh command: `npm run data:openrouter`
- Optional environment variables:
  - `OPENROUTER_MODELS_URL`: override the default API URL.
  - `OPENROUTER_API_KEY`: optional Bearer token for future auth or rate-limit changes.

OpenRouter is currently the first-pass base catalog source. It provides route IDs, display names, canonical slugs, context windows, architecture fields, supported parameters, and token pricing.

mddb.dev uses the OpenRouter route as an observation. The provider namespace in a route such as `anthropic/claude-sonnet-4` is not automatically part of the canonical identity.

### models.dev

- Endpoint: `https://models.dev/api.json`
- Local snapshot: `data/models-dev-api.json`

models.dev is a secondary enrichment source. It is useful for provider availability, logos, metadata, pricing observations, and discovery of candidates that OpenRouter does not currently cover.

If a models.dev record matches an existing OpenRouter-derived canonical tag, it enriches that model. If it does not match safely, it becomes a waiting-list candidate instead of automatically becoming a canonical model.

### BaseLLM / NewAPI metadata

- Site: `https://basellm.github.io/llm-metadata/`
- Local snapshot: `data/basellm-newapi.json`

BaseLLM / NewAPI data enriches pricing and availability for the NewAPI ecosystem.

BaseLLM records do not replace canonical models. They become pricing or availability variants under the same canonical model when matched safely.

NewAPI ratio conversion uses:

```text
500,000 tokens = $1
ratio 1 = $2 / 1M tokens
price_per_1m_usd = ratio * 2
```

## Identity model

### Canonical tag

A canonical tag is the stable model ID used in URLs and joins.

Rules:

- lowercase ASCII;
- URL-safe: `a-z`, `0-9`, and `-` only;
- globally unique inside the registry;
- stable across snapshots and deployments;
- based on the logical model name after non-identity modifiers are extracted;
- never reused for a different logical model.

A canonical tag should not contain:

- provider route prefixes such as `anthropic/`, `openai/`, or `google/`;
- date snapshot suffixes such as `2024-08-06` or `20250514`;
- deployment wrappers such as `azure-`, `bedrock-`, `databricks-`, or region prefixes when they only describe serving location;
- transport or routing suffixes such as `@default`;
- periods, slashes, or underscores.

Examples:

```text
openai/gpt-4o                     -> gpt-4o
openai/gpt-4o-2024-08-06          -> gpt-4o
anthropic/claude-sonnet-4         -> claude-sonnet-4
claude-4-5-haiku                  -> claude-haiku-4-5
gemini-2.5-pro                    -> gemini-2-5-pro
```

### Display name

A display name is how humans should read the model name. It may preserve casing, spaces, punctuation, and periods.

Examples:

```text
gemini-2-5-pro       -> Gemini 2.5 Pro
claude-haiku-4-5     -> Claude Haiku 4.5
gpt-4o               -> GPT-4o
qwen3-235b-a22b      -> Qwen3 235B A22B
```

### Alias

An alias is an external string that resolves to a canonical tag but does not create a new model entity.

Use aliases for official API identifiers, provider routes, aggregator routes, cloud SKUs, regional deployment IDs, dated snapshot IDs, spelling variations, and common colloquial names.

Aliases should be visible and searchable, but they must not inflate model count.

### Snapshot

A snapshot is a dated or versioned release under the same logical model.

Examples:

```text
gpt-4o-2024-08-06       -> canonical gpt-4o, snapshot 2024-08-06
claude-opus-4-6-v1      -> canonical claude-opus-4-6, snapshot v1
```

Do not strip snapshot markers and discard them. Move them into snapshot or source-record metadata.

### Variant

A variant is a user-visible difference under the same canonical model. Use variants for meaningful differences in behavior, capability, context window, output limit, pricing, serving tier, or compliance boundary.

Good variant examples:

- thinking / no-thinking routes;
- free, fast, batch, compact, online, or priority tiers when behavior or price differs;
- different context windows;
- materially different provider-specific limits or capabilities;
- quantization or model-size differences for open models.

Do not create variants for mere spelling changes, route namespaces, region prefixes, or cloud wrappers when they only describe deployment.

### Deployment

A deployment is a provider, aggregator, cloud, region, route, or channel observation serving a canonical model or variant.

Examples: Anthropic, OpenRouter, Azure AI Foundry, Google Vertex, Amazon Bedrock, Databricks, regional API routes, and gateway channels.

Deployments should not create new canonical tags unless the served model is genuinely different.

### Source records and provenance

Every upstream observation should remain explainable. When normalization removes or transforms information, preserve the raw value and transformation evidence in source records.

Source records should preserve raw IDs, raw names, source provider IDs, route namespaces, stripped region or wrapper prefixes, snapshot markers, variant hints, source-specific metadata, and conflict-lost values.

Normalization must not become destructive cleanup.

## Public registry direction

The target public artifacts are stable JSON registry files and projections generated from the same canonical data model.

A likely target layout:

```text
data/
  registry/
    models.json
    aliases.json
    snapshots.json
    variants.json
    deployments.json
    prices.json
    source-records.json
    brands.json
    providers.json
  public-api/
    models.json
    aliases.json
    newapi/ratio_config-v1-base.json
    sub2api/models.json
```

The current implementation is still evolving toward this registry-first shape. Some data is still rendered through TypeScript gallery structures while importers, enrichment logic, and tests are being refactored.

## Repository layout

```text
data/
  openrouter-models.json    OpenRouter source snapshot
  models-dev-api.json       models.dev source snapshot
  basellm-newapi.json       BaseLLM/NewAPI source snapshot
src/
  lib/                      Importers, normalization, enrichment, renderers, tests
  scripts/                  Static site build script
scripts/
  fetch-openrouter-models.mjs
  deploy-static-site.sh
public/                     Generated site output, ignored by git
.internal/                  Local/private maintainer notes, ignored by git
```

`docs/` is intentionally not part of the public repository surface. Maintainer planning notes, research notes, and private operating details belong under `.internal/`, which is ignored by git.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Typecheck:

```bash
npm run typecheck
```

Build the static site:

```bash
npm run build
```

Serve the generated site locally:

```bash
npm run serve
```

Refresh OpenRouter data:

```bash
npm run data:openrouter
```

## Public contribution process

mddb.dev welcomes public contributions, especially corrections that improve canonical identity, source provenance, and pricing accuracy.

### Useful contribution types

- Add or correct aliases with source URLs.
- Fix canonical tag normalization rules.
- Add source-specific importer tests.
- Improve source adapters without losing raw provenance.
- Add pricing conversion tests and edge cases.
- Review waiting-list candidates and explain whether they are canonical models, aliases, variants, deployments, or rejected wrapper records.
- Improve public JSON projections and schema documentation.
- Improve website rendering when it is downstream of registry data.

### Required evidence for data changes

For any model-data correction, include:

- raw upstream model string or route;
- provider/source name;
- source URL;
- proposed canonical tag;
- classification: canonical model, alias, snapshot, variant, deployment, price fact, or rejected/wrapper;
- explanation of why the classification is correct;
- tests or fixture updates when the rule is generalizable.

### Pull request checklist

Before opening a PR:

```bash
npm test
npm run typecheck
npm run build
```

PRs should:

- keep generated `public/` and `dist/` out of git;
- not commit secrets, local tokens, private notes, or `.internal/` files;
- preserve raw source evidence instead of overwriting it with cleaned strings;
- avoid replacing OpenRouter canonical identity with secondary-source names;
- add or update tests for normalization, importer, pricing, or rendering behavior;
- keep changes focused and reviewable.

### Review policy

Maintainers should review registry changes for:

- identity correctness;
- provenance quality;
- source priority and conflict handling;
- risk of alias, typo, wrapper, or gateway pollution;
- deterministic output and stable ordering;
- compatibility with future machine-readable exports.

A candidate should not be promoted into the canonical registry just because it appears in one upstream list. If identity is ambiguous, keep it in the waiting list until there is enough evidence.

## Deployment

The code workspace and runtime directory are intentionally separate.

`npm run build` writes generated HTML to `public/`. The deploy script publishes generated output to the runtime root configured by `RUNTIME_DIR` when deployment is needed.

```bash
npm run deploy
```

Dry run:

```bash
npm run deploy:dry-run
```

## License

mddb.dev is licensed under the GNU Affero General Public License v3.0 or later. See [`LICENSE`](LICENSE).

The AGPL is intentional: if you modify and run this registry as a network service, users interacting with that service should be able to receive the corresponding source code for your modified version.
