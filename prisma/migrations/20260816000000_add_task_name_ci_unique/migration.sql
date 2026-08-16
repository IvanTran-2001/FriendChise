-- Normalize duplicate task names deterministically before enforcing the unique key.
WITH ranked AS (
	SELECT
		id,
		"orgId",
		name,
		"createdAt",
		ROW_NUMBER() OVER (
			PARTITION BY "orgId", lower(btrim(name))
			ORDER BY "createdAt" ASC, id ASC
		) AS rn
	FROM "Task"
),
renamed AS (
	UPDATE "Task" task
	SET name = concat(btrim(task.name), ' [dup-', substr(ranked.id, 1, 8), ']')
	FROM ranked
	WHERE task.id = ranked.id
		AND ranked.rn > 1
	RETURNING task.id
)
SELECT count(*) FROM renamed;

CREATE UNIQUE INDEX "Task_orgId_name_ci_key"
ON "Task" ("orgId", lower(btrim("name")));
