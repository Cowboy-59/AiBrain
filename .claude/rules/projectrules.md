# Project-Specific Rules

<!--
WHAT BELONGS HERE: Project-specific enforcement rules (MUST/NEVER/FORBIDDEN).
WHAT DOESN'T: General documentation (goes in README), implementation tips (goes in dev-guidelines).
Rule of thumb: If it's enforcement for THIS project only, it's here.
-->

Rules specific to this project. Customize for your stack, patterns, and requirements.

See README.md for project documentation/context.

## I. Critical Documentation

<!-- List project-specific documentation that MUST be consulted -->

| Task | Reference Document |
|------|-------------------|
| Example: Server functions | `project-documentation/server-patterns.md` |
| Example: Authentication | `project-documentation/auth-guide.md` |

## II. Schema/Database Patterns

<!-- ORM-specific patterns for your project -->

| Requirement | Rule |
|-------------|------|
| Schema location | `src/db/schema/` |
| Migration workflow | Example: `db:generate` → `db:migrate` |
| Type inference | Example: Use ORM's built-in inference |

## III. File Organization Rules

<!-- Project structure enforcement -->

| Rule | Enforcement |
|------|-------------|
| Routes folder | Only route exports |
| Components | In `src/components/{feature}/` |
| Server functions | In `src/lib/serverFunctions/` |

## IV. UI Patterns

<!-- Reference to project style guides -->

| Rule | Reference |
|------|-----------|
| Primary patterns | `project-documentation/ui-patterns.md` |
| Component library | Example: shadcn/ui |

## V. Testing Rules

<!-- Project testing approach -->

| Rule | Details |
|------|---------|
| Test type | Example: Integration only |
| Test command | Example: `npm test` |

## VI. Development Server

<!-- Dev server rules if AI shouldn't control it -->

| Rule | Details |
|------|---------|
| Port | Example: 3000 |
| Check first | `lsof -i :3000` |
| Log location | Example: `logs/dev.log` |

## VII. Related Projects

<!-- If this project has sibling projects -->

Delete this section if not applicable.

| Project | Purpose |
|---------|---------|
| Example: `api-service` | Backend API |
