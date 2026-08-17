-- Normalize duplicate task names deterministically before enforcing the unique key.
DO $$
DECLARE
	task_row RECORD;
	candidate_name TEXT;
	attempt INTEGER;
BEGIN
	FOR task_row IN
		SELECT id, "orgId", name, rn
		FROM (
			SELECT
				id,
				"orgId",
				name,
				ROW_NUMBER() OVER (
					PARTITION BY "orgId", lower(btrim(name))
					ORDER BY "createdAt" ASC, id ASC
				) AS rn
			FROM "Task"
		) ranked
		WHERE rn > 1
		ORDER BY "orgId", lower(btrim(name)), rn, id
	LOOP
		candidate_name := concat(btrim(task_row.name), ' [dup-', task_row.id, '-', task_row.rn, ']');
		attempt := 1;
		WHILE EXISTS (
			SELECT 1
			FROM "Task" t
			WHERE t."orgId" = task_row."orgId"
				AND lower(btrim(t.name)) = lower(btrim(candidate_name))
		) LOOP
			candidate_name := concat(btrim(task_row.name), ' [dup-', task_row.id, '-', task_row.rn, '-', attempt, ']');
			attempt := attempt + 1;
		END LOOP;

		UPDATE "Task"
		SET name = candidate_name
		WHERE id = task_row.id;
	END LOOP;
END $$;

CREATE UNIQUE INDEX "Task_orgId_name_ci_key"
ON "Task" ("orgId", lower(btrim("name")));
