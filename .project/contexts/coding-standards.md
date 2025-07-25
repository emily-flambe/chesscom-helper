# Coding Standards

## Current Implementation Patterns

### TypeScript Standards (As Implemented)
- **Strict Mode**: TypeScript configured with strict mode
- **Type Annotations**: Explicit types for function parameters and returns
- **Interface Definitions**: Environment interface defined at top of file
- **No Any**: Code avoids `any` type usage

### Actual Naming Conventions in Use
- **Main File**: `index.ts` contains entire application
- **Functions**: camelCase (e.g., `hashPassword`, `verifyJWT`, `authenticateRequest`)
- **Constants**: Not consistently uppercase (could be improved)
- **Database Fields**: snake_case (e.g., `chess_com_username`, `created_at`)

### Current Code Organization
```typescript
// Actual structure in index.ts:
// 1. Interface definitions
export interface Env {
  DB: D1Database
  JWT_SECRET: string
  ENVIRONMENT?: string
}

// 2. Imports (minimal - only validation utils)
import { validateEmail, validatePassword } from './utils/validation'

// 3. Helper functions
async function hashPassword(password: string): Promise<string>
async function verifyPassword(password: string, hash: string): Promise<boolean>
async function createJWT(userId: string, secret: string): Promise<string>
async function verifyJWT(token: string, secret: string): Promise<{ userId: string } | null>
async function authenticateRequest(request: Request, env: Env): Promise<{ userId: string } | Response>
function generateId(): string

// 4. Main export with fetch handler
export default {
  async fetch(request: Request, env: Env): Promise<Response>
}

// 5. HTML generation function at bottom
function getHTML(): string
```

### Current Function Patterns
- Functions are generally concise and focused
- Async/await used throughout
- Error handling with try/catch blocks
- Return types explicitly specified

```typescript
// Actual pattern from codebase:
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}
```

## API Implementation Standards

### Current Endpoint Structure
- Routes: `/api/auth/*`, `/api/monitor`, `/api/players`
- No versioning (not `/api/v1/`)
- Manual routing with URL pathname checks
- Consistent JSON responses

### Actual Request Handling
```typescript
// Pattern used in index.ts:
if (url.pathname === '/api/auth/register' && request.method === 'POST') {
  try {
    const body = await request.json() as any
    // validation
    // business logic
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

### Error Response Pattern
```typescript
// Consistent error format used:
return new Response(JSON.stringify({ error: 'Error message' }), {
  status: 400, // or appropriate status
  headers: { 'Content-Type': 'application/json' }
})
```

## Database Patterns in Use

### Query Implementation
```typescript
// Actual pattern with prepared statements:
await env.DB.prepare(`
  INSERT INTO player_subscriptions (id, user_id, chess_com_username, created_at)
  VALUES (?, ?, ?, ?)
`).bind(subscriptionId, userId, username, now).run()

// Fetching with type casting:
const result = await env.DB.prepare(`
  SELECT * FROM users WHERE email = ?
`).bind(email).first() as User | null
```

### Migration Files
- Located in `database/migrations/`
- Named: `0001_initial_schema.sql`, `0002_create_indexes.sql`
- Pure SQL files, no down migrations

## Testing Approach

### Current Test Setup
- Vitest configured but minimal test coverage
- Test files would go in `tests/` directory
- Focus on integration testing once implemented

## Code Quality Practices

### Current Documentation
- Minimal inline comments
- No JSDoc comments in current implementation
- Code is generally self-documenting

### Security Implementation
```typescript
// Input validation example:
if (!validateEmail(body.email)) {
  return new Response(JSON.stringify({ error: 'Invalid email format' }), 
    { status: 400, headers: { 'Content-Type': 'application/json' } })
}

// Prepared statements for SQL injection prevention:
.bind(email, passwordHash, userId, now)
```

## Development Workflow

### Scripts in package.json
- `npm run dev` - Start development server
- `npm run lint` - ESLint checking
- `npm run typecheck` - TypeScript validation
- `npm run test` - Run tests
- `npm run db:migrate` - Apply migrations

### Environment Variables
- Stored in `.dev.vars` for local development
- Required: `JWT_SECRET`, `API_KEY_SALT`
- Accessed via `env.JWT_SECRET` in code

## Areas for Improvement

### Could Be Enhanced
1. Add consistent error codes/types
2. Implement rate limiting
3. Add comprehensive logging
4. Increase test coverage
5. Use installed dependencies (bcrypt, itty-router)
6. Implement the prepared service architecture

### Current Strengths
1. Simple, readable code
2. Type safety throughout
3. Secure SQL practices
4. Clear separation of concerns within single file
5. Fast performance with minimal dependencies