import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const nextHtml = path.join(root, 'src/render-next/next.html')
const app = path.join(root, 'src/render-next/AppNext.vue')
const required = [
  path.join(root, 'src/render-next/screens/OverviewScreen.vue'),
  path.join(root, 'src/render-next/screens/ServicesScreen.vue'),
  path.join(root, 'src/render-next/screens/WebsitesScreen.vue'),
  path.join(root, 'src/render-next/screens/RuntimesScreen.vue'),
  path.join(root, 'src/render-next/screens/DatabasesScreen.vue'),
  path.join(root, 'src/render-next/screens/StartupGroupsScreen.vue'),
  path.join(root, 'src/render-next/screens/ToolsScreen.vue'),
  path.join(root, 'src/render-next/screens/LogsScreen.vue'),
  path.join(root, 'src/render-next/screens/SettingsScreen.vue')
]
for (const file of [nextHtml, app, ...required]) {
  if (!existsSync(file)) throw new Error(`Missing PQT Forge renderer artifact: ${path.relative(root, file)}`)
}
const html = readFileSync(nextHtml, 'utf8')
const appSource = readFileSync(app, 'utf8')
if (!html.includes('src="./next-main.ts"')) throw new Error('next.html does not point to next-main.ts')
for (const name of ['OverviewScreen', 'ServicesScreen', 'WebsitesScreen', 'RuntimesScreen', 'DatabasesScreen', 'StartupGroupsScreen', 'ToolsScreen', 'LogsScreen', 'SettingsScreen']) {
  if (!appSource.includes(name)) throw new Error(`AppNext.vue does not register ${name}`)
}
console.log(`PQT Forge next renderer smoke check passed (${required.length} screens, fixed shell entry present).`)
