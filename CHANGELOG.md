# Changelog

All notable changes to the **AWS Event-Driven Performance Optimization Platform** will be documented in this file.

## [Unreleased] - Layer 0 Completed (2026-09-01)

### Added
- Monorepo directory layout: `/frontend`, `/backend`, `/infrastructure`, `/lambdas`, `/tests`, `/docs`.
- Package management with npm workspaces for monorepo setup.
- TypeScript configurations (`tsconfig.base.json` and project-specific `tsconfig.json` files).
- ESLint and Prettier code quality configurations.
- Environment setup with `docker-compose.yml` for LocalStack and Redis local emulation.
- Baseline Express REST API server in `/backend` with healthcheck endpoint (`GET /api/health`).
- SQS Producer and Worker Lambda handlers stubs in `/lambdas`.
- Polished starter React 18 + Vite + Tailwind CSS frontend dashboard in `/frontend`.
- Initial Vitest test suite with environment sanity checks in `/tests`.
- Architecture (`docs/ARCHITECTURE.md`) and Data Model (`docs/DATA_MODEL.md`) specifications.
- Terraform baseline configuration in `/infrastructure`.
