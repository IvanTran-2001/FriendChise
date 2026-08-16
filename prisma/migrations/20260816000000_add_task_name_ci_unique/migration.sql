-- Enforce case-insensitive, trimmed task names within each org.
CREATE UNIQUE INDEX "Task_orgId_name_ci_key"
ON "Task" ("orgId", lower(btrim("name")));
