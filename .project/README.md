# Project Configuration

This directory contains unified configuration for AI assistants (Claude Code & Gemini CLI).

## Structure
- `config.md` - Main project context and guidelines
- `settings.json` - Unified project settings
- `.env` - Environment variables (not in version control)
- `.env.example` - Template for environment variables
- `contexts/` - Modular context files
  - `architecture.md` - System architecture documentation
  - `coding-standards.md` - Code style and standards
  - `dependencies.md` - Project dependencies and versions
- `scripts/` - Helper scripts
  - `init-project-config.sh` - Initialize/reset configuration

## Usage

### Claude Code
Start your session with:
```
Start by running ls -la and then read and understand the project configuration files in the .project/ directory, particularly: .project/config.md for the main project context and guidelines; .project/contexts/ directory for detailed specifications on architecture, coding standards, and dependencies; and .project/settings.json for project settings. Follow all guidelines and standards defined in these files throughout our conversation.
```

Or add this alias to your shell configuration:
```bash
alias claude-project='claude "Start by running ls -la and then read and understand the project configuration files in the .project/ directory, particularly: .project/config.md for the main project context and guidelines; .project/contexts/ directory for detailed specifications on architecture, coding standards, and dependencies; and .project/settings.json for project settings. Follow all guidelines and standards defined in these files throughout our conversation."'
```

### Gemini CLI
The configuration is automatically loaded via symlinks in `.gemini/`

### Universal Command (works for both)
```
This project uses a unified configuration framework. Please familiarize yourself with:
- Main configuration: .project/config.md
- Architecture details: .project/contexts/architecture.md
- Coding standards: .project/contexts/coding-standards.md
- Dependencies: .project/contexts/dependencies.md
Apply these standards and guidelines to all responses and code generation in this session.
```

## Maintenance
- Run `./init-project-config.sh` to reinitialize
- Update context files as the project evolves
- Keep environment variables in `.env` (copy from `.env.example`)
- Run `.project/scripts/update-context.sh` to update dynamic contexts

## Project-Specific Guidelines

This Chess.com Helper project includes:
- Cloudflare Workers deployment configuration
- D1 database schema and migrations
- JWT authentication implementation
- Chess.com API integration patterns
- Email notification architecture (planned)

Refer to the context files for detailed specifications on each component.