export type ServiceError = {
  ok: false;
  error: string;
  code: "NOT_FOUND" | "CONFLICT" | "INVALID";
};

export type ServiceResult<T> = { ok: true; data: T } | ServiceError;
