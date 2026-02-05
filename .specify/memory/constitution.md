# DEFAULT Constitution

## Core Principles

### I. Unified Full-Stack Architecture
This project is built on a unified TanStack Start architecture. All development must adhere to this stack, which includes:
- **Framework**: TanStack Start (unified full-stack)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk with RBAC (admin/client roles)
- **State Management**: TanStack Query with SWR-style caching

### II. Critical Implementation Patterns (The Bibles)


### III. Database & Naming Conventions
The database schema and naming conventions are non-negotiable.
- **Table Naming**: Singular (e.g., `user`, not `users`).
- **Primary Keys**: Table name suffixed with `id` (e.g., `userid`). All new primary keys MUST use UUID v7 format (`pg_uuidv7()`) for time-ordered UUIDs with better database performance and natural sort order.
- **Foreign Keys**: Foreign keys in child tables should match the parent table primary key name whenever possible (e.g., `customer.customerid` → `invoice.customerid`). For multiple foreign keys to the same parent table, use functional prefixes (e.g., `invoice.salesmanemployeeid` and `invoice.manageremployeeid`).
- **Field Naming**: `lowercase` for PostgreSQL schema fields, `camelCase` for TypeScript variables. Underscores are forbidden for word separation.
- **Schema Changes**: The `db:generate` -> `db:migrate` workflow is mandatory. `db:push` is forbidden in production.

### IV. Code Quality & Styling
Code must adhere to the project's established quality and style standards.
- **TypeScript**: All new code must be in TypeScript. Use functional components with hooks.
- **Testing**: Test integrations with real APIs, not mocks.
- **Architecture**: Follow established file organization patterns and maintain a clear separation between features.
- **Components**: Keep components focused and reusable.
- **Naming Conventions**: Use consistent naming conventions across the codebase.

### V. Security & Data Protection
Security standards are non-negotiable and must be implemented throughout the application.
- **Environment Variables**: Use environment variables for all sensitive data. NEVER hardcode API keys, credentials, or sensitive configuration.
- **Error Handling**: Always implement proper error handling with secure error messages that don't expose internal system details.

### VI. Early Development Philosophy

**Breaking Changes Over Technical Debt**: This project is in early active development. We prioritize clean architecture and maintainable code over backward compatibility concerns.

**Clean Cutover Principle**: When evolving data models, API contracts, or core architecture:
- **Preferred**: Complete replacement with clean migration
- **Avoided**: Gradual migration with compatibility layers
- **Forbidden**: Maintaining deprecated patterns alongside new ones

**Legacy Support Policy**:
- No legacy support requirements during pre-1.0 development
- Breaking changes are acceptable and often preferred
- Focus on the best long-term architecture, not short-term compatibility
- Clean code and simple design trump migration complexity

**Implementation Guidelines**:
- Replace entire entities/patterns rather than extending them
- Drop deprecated tables/code completely after migration
- No filtering or compatibility layers for "legacy" functionality
- Single source of truth for all data and business logic

**Justification**: Early development stage allows us to make optimal architectural decisions without being constrained by legacy considerations. Clean, simple designs are easier to understand, maintain, and extend than compatibility-laden architectures.

## Forbidden Actions

The following actions are strictly forbidden:
- **Database**: No schema modifications (`DROP`, `ALTER`, `CREATE`) without explicit approval. Do not use `db:push` on a populated database.
- **Code Management**: No substituting technology stack components. No using underscores in variable, table, or field names.
- **Environment**: Never overwrite existing environment variables without explicit user consent.

## Governance


- Any deviation or amendment requires a documented proposal, review, and approval from the project lead.
- All code reviews must verify compliance with this constitution.

**Version**: 1.1.0 | **Ratified**: 2025-09-17 | **Last Amended**: 2025-09-17

**Amendment 1.1.0 Changes**:
- Added UUID v7 standard for primary keys (`pg_uuidv7()`)
- Added foreign key naming conventions for consistency
- Added comprehensive Security & Data Protection section