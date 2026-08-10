export type StorageErrorCode = "unauthorized" | "invalid_input" | "storage_failure";

export function storageErrorStatus(code?: StorageErrorCode) {
  switch (code) {
    case "unauthorized":
      return 403;
    case "storage_failure":
      return 500;
    default:
      return 400;
  }
}