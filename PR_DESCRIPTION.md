# Connect Dev Sign-In UI to Seeded Users

## Problem

Dev sign-in was disconnected from the seeded users system:

- The dev user picker had hardcoded emails without namespaces (e.g., `owner@example.test`)
- Test helpers and E2E setup used `resolveSeedEmail()` with env var fallbacks instead of constants
- Seeded data couldn't be accessed consistently across local dev, tests, and UI
- Contributors had to manually figure out which email to use

## Solution

Introduced a single source of truth for seeded users and wired it through the entire dev flow:

### 1. Central Seeded Users Constant (`lib/seeded-users.ts`)

Exports `SEEDED_USERS` object with all 9 seeded identities and their namespaced emails/display names using `seedEmail()` from the seed namespace system. Similar to how `authConfig` centralizes auth configuration.

```typescript
import { SEEDED_USERS } from "@/lib/seeded-users";
const email = SEEDED_USERS.owner.email; // owner+namespace@example.test
```

### 2. Test Integration

Updated test files to reference `SEEDED_USERS` instead of env var fallbacks:

- `__tests__/e2e/auth.setup.ts`: Uses `SEEDED_USERS.riley` for E2E auth
- `__tests__/integration/helpers.ts`: Uses `SEEDED_USERS.casey` for integration tests

This ensures tests always use the exact same identities that were seeded, preventing mismatches.

### 3. Dev Sign-In Flow (`app/(auth)/signin/*`)

Connected UI to seeded data:

- `get-dev-users.ts`: Server function that builds the user list from `SEEDED_USERS`
- `dev-user-picker.tsx`: Now accepts `users` as a prop (follows React best practices for testability)
- `page.tsx`: Calls `getDevUsers()` and passes to picker

The picker now displays seeded users with correct namespaced emails and roles, all generated from a single source.

## Code Standards Applied

- **Centralized configuration**: Patterns similar to `auth.config.ts` (single config file, exported constants)
- **Type safety**: Exported `SeededUserId` type for type-safe user references
- **Server functions**: `get-dev-users.ts` runs on server only (avoids exposing logic to client unnecessarily)
- **Reusable utilities**: Leveraged existing `seedEmail()` and `seedDisplayName()` from seed-namespace system
- **Documentation**: Clear JSDoc comments explaining purpose and usage
- **No duplication**: Removed hardcoded user list; users now defined once and referenced everywhere

## Testing

- ✅ TypeScript: No errors
- ✅ E2E tests: 22 passed, 1 skipped
- ✅ Prettier: Code formatted
- ✅ Integration: Tests use `SEEDED_USERS.casey` successfully

## Documentation Updated

- `CONTRIBUTING.md`: Updated sign-in instructions to reflect searchable user picker
- `README.md`: Reflected in local dev section

## Files Changed

- **New**: `lib/seeded-users.ts`, `app/(auth)/signin/get-dev-users.ts`
- **Modified**:
  - `app/(auth)/signin/dev-user-picker.tsx` (accepts users prop)
  - `app/(auth)/signin/page.tsx` (calls getDevUsers)
  - `__tests__/e2e/auth.setup.ts` (uses SEEDED_USERS)
  - `__tests__/integration/helpers.ts` (uses SEEDED_USERS)
  - `CONTRIBUTING.md` (updated docs)
