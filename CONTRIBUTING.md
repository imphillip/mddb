# Contributing to mddb.dev

Thank you for helping improve mddb.dev. This project is an open LLM model registry, so data quality and provenance matter as much as code quality.

## Contribution priorities

Good public contributions include:

- canonical model identity corrections;
- alias additions with source evidence;
- snapshot and variant classification fixes;
- provider deployment and availability observations;
- pricing normalization and conversion fixes;
- importer improvements that preserve raw source records;
- tests for model normalization, source importers, waiting-list classification, and rendering;
- public JSON export/schema improvements;
- website improvements that are generated from registry data.

## Data contribution requirements

For any model-data change, include the evidence needed for review:

- raw upstream model string or route;
- provider/source name;
- source URL;
- proposed canonical tag;
- proposed classification:
  - canonical model;
  - alias;
  - snapshot;
  - variant;
  - deployment;
  - price fact;
  - rejected wrapper/proxy/typo;
  - waiting-list candidate;
- explanation of why the classification is correct;
- tests or fixture updates when the rule is reusable.

Avoid data-only PRs that say only "add model X" without a source URL and classification rationale.

## Identity review rules

mddb.dev is OpenRouter-first for canonical identity and treats secondary sources as controlled enrichment.

Reviewers should reject or request changes for PRs that:

- turn provider routes into canonical model tags without evidence;
- create duplicate models for snapshots, aliases, regions, or cloud wrappers;
- overwrite primary canonical identity with a secondary-source spelling;
- discard raw upstream evidence during normalization;
- collapse meaningful variants into one price or context window;
- add wrapper, proxy, typo, or gateway names as first-class models;
- make generated output non-deterministic.

When identity is ambiguous, keep the record in the waiting list until there is enough evidence.

## Development workflow

Install dependencies:

```bash
npm install
```

Run the required checks before opening a PR:

```bash
npm test
npm run typecheck
npm run build
```

Useful optional check:

```bash
git status --short --ignored
```

Generated directories such as `public/`, `dist/`, and `node_modules/` should stay out of git.

## Pull request checklist

Before submitting, confirm:

- [ ] The change has source evidence when it affects registry data.
- [ ] Canonical tags are stable logical model IDs, not provider routes.
- [ ] Aliases, snapshots, variants, deployments, and price facts are classified separately.
- [ ] Raw source/provenance is preserved where normalization transforms fields.
- [ ] Tests were added or updated for general rules.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] No secrets, local notes, `.internal/` files, or generated site output were committed.

## Commit style

Use focused commits with conventional prefixes when practical:

```text
feat: add registry projection for aliases
fix: classify claude fast routes as variants
docs: document NewAPI ratio conversion
test: cover snapshot alias normalization
```

## Private/internal files

`.internal/` is ignored by git and is reserved for maintainer planning notes, local research, deployment details, and other non-public artifacts. Do not reference `.internal/` content from code or public docs unless the relevant information has been intentionally copied into a public file such as `README.md`.

## License

By contributing, you agree that your contribution is licensed under the GNU Affero General Public License v3.0 or later, the same license as the project.
