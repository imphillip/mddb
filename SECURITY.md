# Security Policy

## Reporting vulnerabilities

Please do not open a public issue for sensitive security reports.

If you discover a vulnerability, contact the maintainers privately through the repository owner's preferred security contact. If no private channel is listed, open a minimal public issue asking for a private reporting channel without disclosing exploit details.

## Scope

Security reports may include:

- exposed secrets or credentials;
- unsafe handling of upstream data;
- script injection in generated pages;
- dependency vulnerabilities with a reachable impact;
- deployment or build behavior that could expose private files.

## Data quality issues

Incorrect model metadata, pricing errors, alias mistakes, and provider misclassification are usually data-quality issues rather than security vulnerabilities. Please report those through normal issues or pull requests with source evidence.

## Maintainer expectations

Maintainers should:

- acknowledge valid security reports as soon as practical;
- avoid publishing sensitive details before a fix is available;
- credit reporters when they want credit;
- keep `.internal/`, local credentials, and generated deployment artifacts out of public releases.
