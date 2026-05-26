# Contributing to mddb.dev

Thank you for helping improve mddb.dev. This project is an open LLM model registry, so data quality and provenance matter as much as code quality.

## Contribution priorities

Good public contributions include:

- canonical model identity corrections;
- alias additions with source evidence;
- model spec, modality, context, lifecycle, and capability fixes;
- source/provenance improvements for `data/models.json`;
- importer improvements that preserve raw source records;
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
  - capability/spec update;
  - lifecycle update;
  - rejected wrapper/proxy/typo;
- explanation of why the classification is correct;
- tests or fixture updates when the rule is reusable.

Avoid data-only PRs that say only "add model X" without a source URL and classification rationale.

## Identity review rules

mddb.dev is source-evidence-first for canonical identity. OpenRouter, LiteLLM, Bailian, and Volcengine may all supplement canonical models when the source data fits the current schema. USD-priced sources do not have higher authority than CNY-priced sources; processing order is not authority. models.dev is icon/logo enrichment only and is not a canonical model source.

Reviewers should reject or request changes for PRs that:

- turn provider routes into canonical model tags without evidence;
- create duplicate models for aliases, regions, or cloud wrappers;
- overwrite primary canonical identity with a secondary-source spelling;
- discard raw upstream evidence during normalization;
- collapse meaningful model capabilities or lifecycle facts without evidence;
- add wrapper, proxy, typo, or gateway names as first-class models;
- make generated output non-deterministic.

When identity is ambiguous, keep it out of `data/models.json` until there is enough evidence.

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
- [ ] Aliases and wrapper/proxy routes are not promoted into duplicate models.
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
