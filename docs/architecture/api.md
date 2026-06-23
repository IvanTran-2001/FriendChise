---

title: API

order: 18.5

---
The app no longer exposes a broad CRUD REST API. The remaining routes are small helper endpoints used by client components for lazy loading, route-aware UI checks, or test auth.

## App helper routes

### Parent-owner check

Route: `/api/orgs/[orgId]/is-parent-owner`

| Method | Auth      | Description |
| ------ | --------- | ----------- |
| `GET`  | Signed in | Returns `{ isParentOwner, parentOrgId }` so the sidebar can show the correct franchisor navigation. |

### Roster entry loading

Route: `/api/orgs/[orgId]/roster-entries`

| Method | Auth   | Description |
| ------ | ------ | ----------- |
| `GET`  | Member | Returns roster entries for the requested weeks. Used by the roster page to fetch missing weeks as the visible window moves. |

Query params:

- `weeks` - comma-separated ISO week-start dates
- up to 20 weeks per request

### Paginated tasks

Route: `/api/orgs/[orgId]/tasks/paginated`

| Method | Auth   | Description |
| ------ | ------ | ----------- |
| `GET`  | Member | Returns cursor-based task pages for infinite scroll. Used by the task table when the user scrolls or changes filters/search. |

Query params:

- `mode` - `list`, `available`, or `shared`
- `cursor` - cursor from the previous page
- `limit` - number of items per page
- `sort` - task sort option
- `roleId`, `tagId`, `search` - optional filters

The endpoint also resolves signed image URLs for tasks that have images.

## Framework and test routes

### Auth.js

Route: `/api/auth/[...nextauth]`

| Method | Description |
| ------ | ----------- |
| `GET` / `POST` | Handled by Auth.js. No custom app logic lives here. |

### Test login

Route: `/api/test/login`

| Method | Auth | Description |
| ------ | ---- | ----------- |
| `GET`  | Test-only | Creates a real Auth.js session cookie for Playwright. Only enabled when `TEST_MODE=1`. |

## Removed CRUD surface

The older org, membership, task-definition, and timetable-entry REST routes are no longer present in `app/api`. State changes now happen through server actions or page-specific fetch helpers instead of a broad REST API.
