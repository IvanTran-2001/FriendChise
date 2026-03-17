import { getTasks } from "@/lib/services/tasks";
import { requireOrgMember } from "@/lib/authz";
import { redirect } from "next/navigation";

const TasksPage = async ({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) => {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  const tasks = await getTasks(orgId);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Tasks</h1>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="border rounded-lg p-4 flex flex-col gap-1"
            >
              <span className="font-medium">{task.title}</span>
              {task.description && (
                <span className="text-sm text-muted-foreground">
                  {task.description}
                </span>
              )}
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span>Duration: {task.durationMin} min</span>
                <span>People required: {task.peopleRequired}</span>
                {task.minWaitDays != null && (
                  <span>Min wait: {task.minWaitDays}d</span>
                )}
                {task.maxWaitDays != null && (
                  <span>Max wait: {task.maxWaitDays}d</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TasksPage;
