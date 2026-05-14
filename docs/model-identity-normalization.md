# Model identity normalization

mddb.dev's core value is turning messy upstream model strings into a stable, explainable model identity graph. A model should not become a new registry entity just because it appears under a different provider route, region prefix, cloud SKU, snapshot suffix, or marketing spelling.

This document defines the first-pass rules for canonical tags, display names, aliases, snapshots, variants, and deployments.

## Identity layers

Every upstream model observation should be decomposed into these layers, in this order:

1. **Canonical tag**: the stable logical model identity used in URLs and joins.
2. **Display name**: the human-readable name for the model entity.
3. **Aliases**: external strings that resolve to the canonical tag.
4. **Snapshots**: dated or versioned releases of the same logical model.
5. **Variants**: user-visible behavior, limit, pricing, or capability differences under the same logical model.
6. **Deployments**: providers, clouds, regions, or aggregators serving the model.
7. **Source records**: lossless raw observations and fields transformed during normalization.

Do not skip directly from a raw upstream string to a rendered model card. First decide what part of the string expresses identity and what part expresses alias, snapshot, variant, or deployment metadata.

## Canonical tag

A canonical tag answers one question: **which logical model entity is this?**

Canonical tags are used in URLs such as:

```text
/models/claude-opus-4-6
/models/gemini-2-5-pro
/models/gpt-4o
```

### Grammar

A canonical tag MUST be:

- lowercase ASCII;
- URL-safe: `a-z`, `0-9`, and `-` only;
- globally unique within the registry;
- stable across snapshots and provider deployments;
- based on the vendor's logical model name after non-identity modifiers are extracted;
- never reused for a different logical model.

A canonical tag MUST NOT contain:

- period (`.`);
- slash (`/`);
- underscore (`_`);
- date snapshot suffixes such as `2024-08-06` or `20250514`;
- semantic snapshot suffixes such as `v1` when they denote a release record;
- provider route prefixes such as `anthropic/`, `openai/`, `google/`;
- cloud or deployment wrappers such as `databricks-`, `azure-`, `bedrock-`, unless manual review decides the wrapper denotes a genuinely different model;
- region prefixes such as `us-`, `eu-`, `jp-`, `global-`, `au-` when they only denote deployment location;
- transport or routing suffixes such as `@default`;
- deployment-only labels such as `default`, when they do not change model behavior.

### Why canonical tags do not use periods

Periods are valid in many URLs, but mddb.dev deliberately avoids them in canonical tags.

Benefits:

- URLs are less ambiguous: `/models/gemini-2-5-pro` cannot be confused with a file-like path segment.
- Future JSON resources stay clear: `/models/gemini-2-5-pro.json` is easier to parse than `/models/gemini-2.5-pro.json`.
- Static hosts, CDNs, object stores, logs, analytics tools, and OpenAPI path params handle hyphen-only slugs more predictably.
- Search/tokenization is more consistent because `-` is the only separator.
- The registry avoids permanent duplicate spelling debates such as `2.5` vs `2-5`.

Display names can and should retain periods where humans expect them.

### Examples

```text
Raw / external string                  canonical tag
----------------------------------------------------
Gemini 2.5 Pro                         gemini-2-5-pro
gemini-2.5-pro                         gemini-2-5-pro
GPT-4o                                 gpt-4o
gpt-4o-2024-08-06                      gpt-4o
claude-opus-4.6                        claude-opus-4-6
claude-4-6-opus                        claude-opus-4-6
claude-opus4-6                         claude-opus-4-6
claude-haiku-4-5-20251001              claude-haiku-4-5
claude-4-5-haiku                       claude-haiku-4-5
claude-haiku4-5                        claude-haiku-4-5
claude-sonnet-4-5-20250929             claude-sonnet-4-5
claude-4-5-sonnet                      claude-sonnet-4-5
claude-sonnet4-5                       claude-sonnet-4-5
claude-opus-4-6-v1                     claude-opus-4-6
anthropic/claude-opus-4.6              claude-opus-4-6
eu-anthropic-claude-opus-4-6           claude-opus-4-6
databricks-claude-opus-4-6             claude-opus-4-6
claude-opus-4-6@default                claude-opus-4-6
deepseek-r1                            deepseek-r1
qwen3-235b-a22b                        qwen3-235b-a22b
```

Provider prefixes should only appear in canonical tags as a last-resort manual disambiguation when two unrelated vendors use the same logical model string for different entities.

## Display name

A display name answers: **how should humans read this model name?**

Rules:

- Use the official or clearest human-readable product name.
- Preserve normal product casing, spaces, and periods.
- Do not blindly use noisy provider route names as display names.
- Do not include provider wrappers when they only describe a deployment.
- Display names may evolve as official naming changes; canonical tags should remain stable.

Examples:

```text
canonical tag          display name
-----------------------------------
gemini-2-5-pro         Gemini 2.5 Pro
claude-opus-4-6        Claude Opus 4.6
gpt-4o                 GPT-4o
deepseek-r1            DeepSeek R1
qwen3-235b-a22b        Qwen3 235B A22B
```

Bad display-name sources:

- `Databricks Claude Opus 4.6` when `Databricks` is just the serving platform.
- `EU Anthropic Claude Opus 4.6` when `EU` is just a region.
- `anthropic/claude-opus-4.6` when it is a route string.

Those facts belong in deployments, aliases, and source records.

## Alias

An alias is any external string that should resolve to a canonical tag but does not create a new model entity.

Use an alias when the raw string is:

- an official API identifier;
- a provider route;
- an aggregator route;
- a cloud marketplace SKU;
- a regional deployment ID;
- a known spelling/order variation;
- a marketing alias;
- a dated or versioned snapshot identifier that should also point to the canonical model.

Alias records should preserve:

- `alias`: raw alias string;
- `normalized_alias`: lookup-normalized alias;
- `model_tag`: canonical tag;
- `source`: where the alias came from;
- `alias_type`: `official`, `snapshot`, `provider_route`, `third_party`, `colloquial`, etc.;
- `confidence`: deterministic or manually assigned confidence.

Examples:

```text
alias                                canonical tag          alias type
------------------------------------------------------------------------
anthropic/claude-opus-4.6            claude-opus-4-6        provider_route
claude-4-6-opus                      claude-opus-4-6        third_party
claude-opus4-6                       claude-opus-4-6        third_party
eu-anthropic-claude-opus-4-6         claude-opus-4-6        provider_route
claude-opus-4-6-v1                   claude-opus-4-6        snapshot
gpt-4o-2024-08-06                    gpt-4o                 snapshot
chatgpt-4o-latest                    gpt-4o                 colloquial
```

Aliases are lookup facts. They should be searchable and visible on model detail pages, but they should not inflate the model count.

### Anthropic Claude family-order aliases

Anthropic and downstream providers often spell the same Claude family release in multiple token orders. For Claude family names with a numeric major/minor release, mddb.dev canonicalizes to:

```text
claude-<family>-<major>-<minor>
```

where `<family>` is currently `opus`, `sonnet`, or `haiku`. Equivalent family/version orderings are aliases, not new models:

```text
alias                                canonical tag          alias type
------------------------------------------------------------------------
claude-haiku-4-5-20251001            claude-haiku-4-5       snapshot
claude-haiku-4-5                     claude-haiku-4-5       official
claude-4-5-haiku                     claude-haiku-4-5       third_party
claude-haiku4-5                      claude-haiku-4-5       third_party
claude-sonnet-4-5-20250929           claude-sonnet-4-5      snapshot
claude-4-5-sonnet                    claude-sonnet-4-5      third_party
claude-opus4-6                       claude-opus-4-6        third_party
```

Dated IDs such as `claude-haiku-4-5-20251001` still create snapshot records, but their canonical tag stays `claude-haiku-4-5`. Do not create separate entities for `claude-4-5-haiku` or `claude-haiku4-5` unless manual review confirms a vendor uses that string for a different logical model.

## Snapshot

A snapshot is a concrete dated or versioned release of the same logical model.

Use a snapshot when the suffix indicates release identity or version history:

- date snapshots: `2024-08-06`, `20250514`;
- semantic release markers: `v1`, `v2`;
- vendor-native snapshot IDs when documented as release records.

Do not simply strip snapshot suffixes and discard them. Move them into `model_snapshots` or an equivalent source record.

Example:

```text
raw id:         claude-opus-4-6-v1
canonical tag: claude-opus-4-6
snapshot id:   claude-opus-4-6-v1
snapshot:      v1
alias:         claude-opus-4-6-v1 -> claude-opus-4-6
```

Floating labels require care:

- `latest` is usually an alias, not a snapshot, because it changes target over time.
- `preview` may be a snapshot, variant, or separate model depending on vendor semantics.

## Variant

A variant is a user-visible difference under the same canonical model. Use variants only when a user might need to choose or understand a difference in behavior, capability, limits, price, or serving semantics.

Use a variant for:

- reasoning / thinking behavior differences;
- no-thinking vs thinking routes;
- context window differences;
- output limit differences;
- batch / priority / fast / compact tiers when they affect price or behavior;
- cloud-hosted forms that materially change available features, limits, or compliance boundaries;
- quantization or model-size differences for open models.

Do not use a variant for:

- mere provider availability;
- a region prefix only;
- a cloud wrapper only;
- a route namespace only;
- a spelling/order variation only;
- a snapshot that is better represented in version history.

Examples:

```text
raw string                                canonical tag          variant?
-------------------------------------------------------------------------
claude-opus-4-6-thinking                  claude-opus-4-6        yes: reasoning behavior
claude-opus-4-6-fast                      claude-opus-4-6        maybe: serving tier, if behavior/price differs
gemini-2-5-flash-nothinking               gemini-2-5-flash       yes: reasoning behavior
azure-claude-opus-4-6                     claude-opus-4-6        no: deployment
us-anthropic-claude-opus-4-6              claude-opus-4-6        no: deployment/region
anthropic/claude-opus-4.6                 claude-opus-4-6        no: alias/deployment
claude-opus-4-6-v1                        claude-opus-4-6        no: snapshot
```

## Deployment

A deployment is a provider, cloud, region, tenant, or aggregator serving a canonical model or variant.

Deployment facts include:

- provider/platform: Anthropic, OpenRouter, Azure AI Foundry, Vertex, Bedrock, Databricks;
- region: `us`, `eu`, `jp`, `global`, etc.;
- route namespace or raw provider path;
- account/tier/SLA information if known;
- provider-specific availability or limits.

Different deployments should not create new canonical tags unless the served model is genuinely different.

## Source records and lossy fields

Every upstream observation should remain explainable. If normalization removes or transforms information, preserve it in a source record.

Examples of fields to preserve:

- raw model ID;
- raw model name;
- source provider ID;
- route namespace stripped from ID;
- region prefix stripped from ID;
- provider wrapper stripped from ID;
- snapshot suffix moved to snapshot records;
- variant hints extracted from suffixes;
- source-specific metadata not yet represented in canonical columns;
- conflict-lost values when another source wins.

Normalization must not become destructive cleanup. A detail page should eventually explain both the canonical registry belief and the original upstream facts.

## Recommended processing order

For each upstream model record:

1. **Parse raw source**
   - source name;
   - source provider;
   - raw ID;
   - raw display name;
   - route namespace;
   - metadata fields.

2. **Normalize candidate string**
   - lowercase;
   - trim whitespace;
   - convert punctuation, spaces, `/`, `_`, and `.` to `-`;
   - collapse repeated separators;
   - split route namespace into source/deployment metadata.

3. **Extract source modifiers**
   - provider prefix;
   - region prefix;
   - cloud/deployment wrapper;
   - date snapshot;
   - semantic snapshot;
   - behavior suffix such as `thinking`, `nothinking`, `fast`, `compact`, `batch`;
   - transport suffix such as `@default`.

4. **Resolve canonical tag**
   - manual override first;
   - exact known alias;
   - deterministic family-specific rules;
   - safe fallback candidate only when no ambiguity remains.

5. **Attach non-identity facts**
   - alias records;
   - snapshot records;
   - variant hints;
   - deployment records;
   - lossy/source record.

6. **Generate display name**
   - start from official/manual display name when available;
   - otherwise derive from canonical family/version;
   - avoid provider/region wrappers unless they represent identity.

7. **Validate before publishing**
   - no raw route-only IDs leaked as canonical tags;
   - no snapshot-only IDs leaked as canonical tags;
   - model count does not grow because one provider has many route spellings;
   - source records explain every stripped or transformed component.

## Implementation direction

Normalization rules should live in a dedicated identity module, not inside rendering code.

Target interface:

```ts
type ModelIdentityResolution = {
  canonicalTag: string
  displayNameCandidate: string
  aliases: AliasObservation[]
  snapshot: SnapshotObservation | null
  variantHints: VariantHint[]
  deploymentHints: DeploymentHint[]
  sourceRecord: SourceRecord
}
```

The renderer should consume already-normalized model identity data. It should not contain provider-specific regexes for deciding model identity.
