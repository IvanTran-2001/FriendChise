/**
 * Shared return types for all service functions.
 *
 * Service functions return a `ServiceResult<T>` discriminated union so callers
 * can handle errors by checking `result.ok` before accessing `result.data`.
 * Errors carry a `code` to allow callers to map to HTTP status codes:
 *   NOT_FOUND → 404, CONFLICT → 409, INVALID → 400
 */
export type ServiceError = {
  ok: false;
  error: string;
  code: "NOT_FOUND" | "CONFLICT" | "INVALID";
};

export type ServiceResult<T> = { ok: true; data: T } | ServiceError;
