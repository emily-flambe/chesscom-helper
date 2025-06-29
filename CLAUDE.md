# Claude Development Guidelines

This file contains important instructions for Claude Code when working on this project.

## Claude Agent Roles

When working on this project, Claude agents should identify their role and responsibilities:

### 🖊️ Code Writer
- Implements new features and functionality
- Fixes bugs and issues in existing code
- Follows established code patterns and conventions
- Ensures code is clean, readable, and well-structured
- Updates documentation when adding new features

### 🧪 Test Writer
- Creates comprehensive test suites for new features
- Writes unit tests, integration tests, and end-to-end tests
- Ensures high test coverage for critical functionality
- Follows testing best practices and patterns
- Creates test fixtures and mock data as needed

### 🚀 Test Runner
- Executes test suites and reports results
- Runs linting and code quality checks
- Validates that all tests pass before code changes
- Identifies and reports test failures with detailed information
- Ensures CI/CD pipeline requirements are met

### 👁️ Code Reviewer
- Reviews code changes for quality, security, and best practices
- Identifies potential bugs, performance issues, and security vulnerabilities
- Ensures code follows project conventions and standards
- Provides constructive feedback and improvement suggestions
- Validates that changes meet requirements and don't break existing functionality

**Note**: A single Claude instance may take on multiple roles during development, but should clearly identify which role they are performing for each task.

## Branch Management and Pull Request Policy

**🚨 NEVER PUSH DIRECTLY TO MAIN BRANCH**

- Always create a feature branch for any changes
- Open a pull request for all changes, no matter how small
- Wait for review/approval before merging to main
- Use descriptive branch names like `feature/email-notifications` or `fix/user-validation`

## Workflow

1. **Create a new branch** for your changes if you are currently on the `main` branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them:
   ```bash
   git add .
   git commit -m "Your descriptive commit message"
   ```

3. **Push the branch** to remote:
   ```bash
   git push -u origin feature/your-feature-name
   ```

4. **Create a pull request** using GitHub CLI:
   ```bash
   gh pr create --title "Your PR Title" --body "Description of changes"
   ```

5. **Never use `git push origin main`** - this pushes directly to main

## Code Quality

- Always run tests before creating a PR
- Follow existing code conventions and patterns
- Update documentation when adding new features
- Include clear commit messages explaining the "why" not just the "what"

## Emergency Exceptions

The only exception to this rule is for critical production hotfixes, which should still be followed by a retroactive PR for documentation purposes.

---

*This file helps maintain code quality and collaboration standards for the project.*