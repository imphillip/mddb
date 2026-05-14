# mddb.dev

An open registry for LLM models: metadata, pricing, snapshots, aliases, and an industry feed indexed by model name.

mddb.dev is built around one simple idea: a model should have a stable identity even when it appears under different provider names, API routes, versions, and pricing sheets.

The project is still early. The first public surface is a human-facing model plaza at [mddb.dev/models](https://mddb.dev/models/). The registry and data pipeline will grow from there.

## What this repo is for

mddb.dev aims to collect and normalize model information that is currently scattered across provider docs, pricing pages, API catalogs, release posts, and community-maintained lists.

The registry will track:

- canonical model names and URL-friendly model tags
- provider aliases and API identifiers
- model metadata such as modalities, context length, release dates, and capabilities
- pricing snapshots over time
- provider deployments for the same underlying model
- model variants when behavior, limits, or pricing differ
- industry news and release notes indexed by model name

## Why model-name indexing matters

LLM models move quickly. A single model can show up as:

- an official provider API name
- a cloud marketplace deployment
- an aggregator route
- a dated snapshot
- a preview alias
- a vendor-specific SKU

mddb.dev treats the model name as the center of the graph. Providers, routes, aliases, snapshots, pricing records, and feed items hang off that canonical model record.

For example, a model page should eventually answer questions like:

- What is the canonical model behind this provider route?
- Which aliases point to the same model?
- What changed between two snapshots?
- Which providers serve it?
- How has pricing changed over time?
- Which announcements, benchmarks, or incidents mention it?

## Current status

The current repository contains a TypeScript static site and a small seed catalog.

Implemented so far:

- model normalization helpers
- a seed model catalog
- a static model plaza at `/models/`
- canonical model detail pages at `/models/<model-name-tag>/`
- deployment script for publishing the generated site to the nginx runtime directory

Still to build:

- structured registry data files
- importers for public model metadata and pricing sources
- pricing snapshot history
- alias and snapshot resolution APIs
- industry feed ingestion
- contribution workflow for new model records and corrections

## Repository layout

```text
src/
  lib/                 Core catalog, normalization, renderer, and tests
  scripts/             Static site build script
scripts/
  deploy-static-site.sh
public/                Generated site output, ignored by git
```

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

## Deployment

The code workspace and runtime directory are intentionally separate.

`npm run build` writes generated HTML to `public/`. The deploy script then publishes that output to the nginx runtime root, currently `/srv/mddb.dev/www` on the production server.

```bash
npm run deploy
```

The deploy script refuses to publish from a dirty workspace by default. Commit first, then deploy. For a dry run:

```bash
npm run deploy:dry-run
```

## Data model direction

The public shape is still being designed, but the registry is expected to revolve around these concepts:

- `model`: the canonical model identity, using a globally unique model name tag
- `alias`: provider names, API strings, marketing names, and legacy names that resolve to a model
- `snapshot`: a dated or versioned release of a model
- `provider_deployment`: a provider or platform serving the model
- `pricing_snapshot`: input, output, cache, image, audio, and other prices at a point in time
- `feed_item`: news, release notes, docs updates, benchmark posts, and incidents linked to models

Canonical model pages use `/models/<model-name-tag>/`. Provider names are metadata, not part of the canonical URL.

The detailed identity rules are documented in [`docs/model-identity-normalization.md`](docs/model-identity-normalization.md). In short: canonical tags are lowercase hyphen-only logical model IDs; display names are human-readable labels; provider routes, region prefixes, spelling variations, snapshots, variants, and deployments are separate records attached to the canonical model rather than new model entities.

## Contributing

This project is not ready for broad external contributions yet, but the goal is to make the registry open and easy to correct.

Good future contributions will likely include:

- adding missing model aliases
- correcting pricing or context limits
- linking release notes to model records
- adding importer adapters for public data sources
- improving normalization rules for messy provider names

If you are interested in the project before the contribution workflow is ready, open an issue with the model name, provider, source URL, and the correction you want to make.

## License

License is not finalized yet. Do not assume reuse rights until a license file is added.
