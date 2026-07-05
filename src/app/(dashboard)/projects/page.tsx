import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  getProjects,
  getAssignableManagers,
  getCustomersForProjects,
} from "../../../../lib/projects/actions";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const roleCheck = await requireRole(["ADMIN", "PROJECTS"]);
  if (!roleCheck.authorized) redirect("/dashboard");

  const [projects, managers, customers] = await Promise.all([
    getProjects(),
    getAssignableManagers(),
    getCustomersForProjects(),
  ]);

  return (
    <ProjectsClient
      initialProjects={projects}
      managers={managers}
      customers={customers}
    />
  );
}
