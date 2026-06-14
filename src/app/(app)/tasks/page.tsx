import { PageHeader } from "@/components/page-header"

import { getTasks } from "./actions"
import { TasksClient } from "./tasks-client"

export default async function TasksPage() {
  const tasks = await getTasks()

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything you need to do, tracked."
      />
      <TasksClient initialTasks={tasks} />
    </div>
  )
}
