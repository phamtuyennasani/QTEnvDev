import { BrewStore } from '@/store/brew'
import { Neo4jManager } from './store'

export function registerNeo4jLifecycle() {
  const module = BrewStore().module('neo4j')
  module.startExtParam ??= (version) => Neo4jManager.startParams(version)
  module.stopExtParam ??= (version) => Neo4jManager.stopParams(version)
}
