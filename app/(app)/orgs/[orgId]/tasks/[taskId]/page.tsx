import { TaskDetailScreen } from "@/src/features/tasks/task-detail-screen";

interface Props {
  params: Promise<{ orgId: string; taskId: string }>;
  searchParams: Promise<{ ref?: string }>;
}

const ViewTaskPage = async ({ params, searchParams }: Props) => {
  const { orgId, taskId } = await params;
  const { ref } = await searchParams;

  const fromTimetable = ref === "timetable";
  const backLabel = fromTimetable ? "← Timetable" : "← Tasks";
  const backHref = fromTimetable
    ? `/orgs/${orgId}/timetable`
    : `/orgs/${orgId}/tasks`;

  return (
    <TaskDetailScreen
      orgId={orgId}
      taskId={taskId}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
};

export default ViewTaskPage;
