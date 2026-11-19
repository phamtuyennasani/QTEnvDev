import { reactiveBind } from '@/util/Index'
import { AllAppModule } from '@/core/type'
import { Project } from './Project'
export type { ProjectItem } from './ProjectItem'

const ProjectSetups: Partial<Record<AllAppModule, Project>> = {}
const directoryInitializations = new Set<AllAppModule>()

export const ProjectSetup = (
  typeFlag: AllAppModule,
  { initializeDirectories = true } = {}
): Project => {
  let project = ProjectSetups[typeFlag]
  if (!project) {
    project = reactiveBind(new Project(typeFlag))
    ProjectSetups[typeFlag] = project
    void project.fetchProject()
  }
  if (initializeDirectories && !directoryInitializations.has(typeFlag)) {
    directoryInitializations.add(typeFlag)
    void project.initDirs()
  }
  return project
}
