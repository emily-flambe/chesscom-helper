# Project: Chess.com Helper

## Overview
Chess.com Helper is a Cloudflare Workers application that provides automated monitoring for Chess.com players. Currently implemented as a monolithic application in `src/index.ts`, it features custom JWT authentication, player subscription management, and Chess.com username validation. The project has a more sophisticated architecture prepared in the `src/` directory that is not yet integrated.

## Current Implementation Status
- **Active**: Single-file implementation in `src/index.ts` with manual routing
- **Prepared but Unused**: Service layer architecture in `src/routes/`, `src/services/`, `src/auth/`
- **Authentication**: Custom SHA-256 password hashing and JWT implementation using Web Crypto API
- **Database**: Cloudflare D1 with defined schema (users, player_subscriptions, player_status, etc.)

## Architecture
<!-- Include architectural decisions, patterns, and structure -->
See: .project/contexts/architecture.md

## Coding Standards
<!-- Language-specific guidelines, formatting rules -->
See: .project/contexts/coding-standards.md

## Dependencies & Versions
<!-- Framework versions, package requirements -->
See: .project/contexts/dependencies.md

## AI Assistant Guidelines

### For All Assistants
- Be aware of the dual implementation state (active monolith vs prepared architecture)
- Current implementation uses custom crypto, not installed libraries
- Follow TypeScript strict mode and type safety requirements
- Include comprehensive error handling with appropriate HTTP status codes
- Write tests for new functionality using Vitest
- Follow Cloudflare Workers best practices for edge computing
- Use environment variables for sensitive configuration

### Tool-Specific Instructions

#### Claude Code
- When modifying code, work with the actual implementation in `src/index.ts`
- Be aware that many installed dependencies are not yet used
- Focus on the working implementation rather than the aspirational architecture
- Consider edge computing constraints when suggesting solutions

#### Gemini CLI
- Use built-in tools for file operations
- Leverage MCP servers when available
- Ensure D1 database migrations match the actual schema

## Project-Specific Guidelines

### Current Security Implementation
- Authentication uses custom JWT implementation with Web Crypto API
- Passwords are hashed using SHA-256 (not bcrypt as dependencies suggest)
- Manual auth header validation in each protected endpoint
- Chess.com username validation against their public API

### Current API Design
- Routes: `/api/auth/register`, `/api/auth/login`, `/api/monitor`, `/api/players`
- No API versioning currently implemented
- Manual routing with if/else statements in main handler
- JSON request/response format

### Database Operations
- Tables: users, player_subscriptions, player_status, user_preferences, notification_log, monitoring_jobs
- Prepared statements used for all queries
- Error handling with try/catch blocks
- Local development with Wrangler D1

### Testing Requirements
- Vitest configured but test coverage needs improvement
- Mock external API calls (Chess.com API)
- Test the actual implementation, not the unused architecture

### Development Process
- Test locally with `npm run dev`
- Run linting and type checking: `npm run lint && npm run typecheck`
- Database operations: `npm run db:setup`, `npm run db:migrate`
- Use feature branches for development