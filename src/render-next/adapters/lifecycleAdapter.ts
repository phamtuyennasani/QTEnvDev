// Modules retain ownership of their data-directory and runtime parameter policies.
const registrations: Record<string, () => Promise<void>> = {
  postgresql: () => import('@/components/PostgreSql/lifecycle').then((module) => module.registerPostgreSqlLifecycle()),
  minio: () => import('@/components/Minio/lifecycle').then((module) => module.registerMinioLifecycle()),
  consul: () => import('@/components/Consul/lifecycle').then((module) => module.registerConsulLifecycle()),
  meilisearch: () => import('@/components/MeiliSearch/lifecycle').then((module) => module.registerMeiliSearchLifecycle()),
  rustfs: () => import('@/components/Rustfs/lifecycle').then((module) => module.registerRustfsLifecycle()),
  tomcat: () => import('@/components/Tomcat/lifecycle').then((module) => module.registerTomcatLifecycle()),
  neo4j: () => import('@/components/Neo4j/lifecycle').then((module) => module.registerNeo4jLifecycle())
}
export async function registerLifecycle(flag: string) {
  await registrations[flag]?.()
}
