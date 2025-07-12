# Claude Code Project Configuration

## Project Identity & Configuration
@include .claude/project-config.yml#ProjectIdentity
@include .claude/project-config.yml#ProjectStructure
@include .claude/project-config.yml#WranglerCommands

## Essential Development Commands
@include .claude/development-commands.yml#PreCommitValidation
@include .claude/development-commands.yml#TroubleshootingCommands
@include .claude/development-commands.yml#BuildSuccessCriteria

## Debugging Lessons Learned
@include .claude/debugging-lessons.yml#WorktreeManagement
@include .claude/debugging-lessons.yml#CloudflareWorkersIssues
@include .claude/debugging-lessons.yml#TypeScriptBuildFailures
@include .claude/debugging-lessons.yml#DatabaseMigrationIssues

## Development Partnership Philosophy

We're building production-quality code together. Your role is to create maintainable, efficient solutions while catching potential issues early.

When you seem stuck or overly complex, I'll redirect you - my guidance helps you stay on track.

## 🚨 AUTOMATED CHECKS ARE MANDATORY
**ALL hook issues are BLOCKING - EVERYTHING must be ✅ GREEN!**  
No errors. No formatting issues. No linting problems. Zero tolerance.  
These are not suggestions. Fix ALL issues before continuing.

## CRITICAL WORKFLOW - ALWAYS FOLLOW THIS!

### Research → Plan → Implement
**NEVER JUMP STRAIGHT TO CODING!** Always follow this sequence:
1. **Research**: Explore the codebase, understand existing patterns
2. **Plan**: Create a detailed implementation plan and verify it with me  
3. **Implement**: Execute the plan with validation checkpoints

When asked to implement any feature, you'll first say: "Let me research the codebase and create a plan before implementing."

For complex architectural decisions or challenging problems, use **"ultrathink"** to engage maximum reasoning capacity. Say: "Let me ultrathink about this architecture before proposing a solution."

### USE MULTIPLE AGENTS!
*Leverage subagents aggressively* for better results:

* Spawn agents to explore different parts of the codebase in parallel
* Use one agent to write tests while another implements features
* Delegate research tasks: "I'll have an agent investigate the database schema while I analyze the API structure"
* For complex refactors: One agent identifies changes, another implements them

Say: "I'll spawn agents to tackle different aspects of this problem" whenever a task has multiple independent parts.

### Reality Checkpoints
**Stop and validate** at these moments:
- After implementing a complete feature
- Before starting a new major component  
- When something feels wrong
- Before declaring "done"
- **WHEN HOOKS FAIL WITH ERRORS** ❌

Run: `make fmt && make test && make lint`

> Why: You can lose track of what's actually working. These checkpoints prevent cascading failures.

### 🚨 CRITICAL: Hook Failures Are BLOCKING
**When hooks report ANY issues (exit code 2), you MUST:**
1. **STOP IMMEDIATELY** - Do not continue with other tasks
2. **FIX ALL ISSUES** - Address every ❌ issue until everything is ✅ GREEN
3. **VERIFY THE FIX** - Re-run the failed command to confirm it's fixed
4. **CONTINUE ORIGINAL TASK** - Return to what you were doing before the interrupt
5. **NEVER IGNORE** - There are NO warnings, only requirements

This includes:
- Formatting issues (gofmt, black, prettier, etc.)
- Linting violations (golangci-lint, eslint, etc.)
- Forbidden patterns (time.Sleep, panic(), interface{})
- ALL other checks

Your code must be 100% clean. No exceptions.

**Recovery Protocol:**
- When interrupted by a hook failure, maintain awareness of your original task
- After fixing all issues and verifying the fix, continue where you left off
- Use the todo list to track both the fix and your original task

## Working Memory Management

### When context gets long:
- Re-read this CLAUDE.md file
- Summarize progress in a PROGRESS.md file
- Document current state before major changes

### Maintain TODO.md:
```
## Current Task
- [ ] What we're doing RIGHT NOW

## Completed  
- [x] What's actually done and tested

## Next Steps
- [ ] What comes next
```

## TypeScript/Node.js-Specific Rules

### FORBIDDEN - NEVER DO THESE:
- **NO any or unknown types** - use concrete types!
- **NO console.log() in production** - use proper logging!
- **NO** keeping old and new code together
- **NO** migration functions or compatibility layers
- **NO** versioned function names (processV2, handleNew)
- **NO** unhandled promise rejections
- **NO** TODOs in final code

> **AUTOMATED ENFORCEMENT**: The lint hooks will BLOCK commits that violate these rules.  
> When you see `❌ FORBIDDEN PATTERN`, you MUST fix it immediately!

### Required Standards:
- **Delete** old code when replacing it
- **Meaningful names**: `userId` not `id`
- **Early returns** to reduce nesting
- **Concrete types** from constructors: `function createServer(): Server`
- **Proper error handling**: `throw new Error('context: message')`
- **Async/await patterns** for asynchronous operations
- **Type-safe database queries** with proper validation

## Implementation Standards

### Our code is complete when:
- ✅ All linters pass with zero issues
- ✅ All tests pass  
- ✅ Feature works end-to-end
- ✅ Old code is deleted
- ✅ JSDoc on all exported functions

### Testing Strategy
- Complex business logic → Write tests first
- Simple CRUD → Write tests after
- Hot paths → Add performance tests
- Skip tests for simple configuration and basic setup

## Problem-Solving Together

When you're stuck or confused:
1. **Stop** - Don't spiral into complex solutions
2. **Delegate** - Consider spawning agents for parallel investigation
3. **Ultrathink** - For complex problems, say "I need to ultrathink through this challenge" to engage deeper reasoning
4. **Step back** - Re-read the requirements
5. **Simplify** - The simple solution is usually correct
6. **Ask** - "I see two approaches: [A] vs [B]. Which do you prefer?"

My insights on better approaches are valued - please ask for them!

## Performance & Security

### **Measure First**:
- No premature optimization
- Benchmark before claiming something is faster
- Use Worker analytics for real bottlenecks

### **Security Always**:
- Validate all inputs
- Use crypto.getRandomValues() for randomness
- Prepared statements for SQL (never concatenate!)
- Rate limiting on all endpoints

## Communication Protocol

### Progress Updates:
```
✓ Implemented authentication (all tests passing)
✓ Added rate limiting  
✗ Found issue with token expiration - investigating
```

### Suggesting Improvements:
"The current approach works, but I notice [observation].
Would you like me to [specific improvement]?"

## Working Together

- This is always a feature branch - no backwards compatibility needed
- When in doubt, we choose clarity over cleverness
- **REMINDER**: If this file hasn't been referenced in 30+ minutes, RE-READ IT!

Avoid complex abstractions or "clever" code. The simple, obvious solution is probably better, and my guidance helps you stay focused on what matters.