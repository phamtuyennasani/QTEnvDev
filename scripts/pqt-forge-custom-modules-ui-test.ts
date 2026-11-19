import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import electron from 'electron'
import viteConfig from '../configs/vite.config'

const root = await mkdtemp(join(tmpdir(), 'pqt-custom-modules-ui-'))
const resultPath = join(root, 'result.json')
const fixturePath = resolve('src/render-next/.custom-modules-ui-fixture.html')
const server = await createServer({ ...viteConfig.serverConfig, configFile: false, server: { port: 0, host: '127.0.0.1' } })
const source = `
import {createApp,nextTick} from 'vue'
import {createPinia} from 'pinia'
import AppNext from './AppNext.vue'
import {navigateNext} from './state/app'
import {customModulesController as controller} from './custom-modules/customModulesController'
import {applyLanguagePayload} from '/@fs/${resolve('src/lang/runtime.ts').replaceAll('\\','/')}'
import localForage from 'localforage'
import setup from '/@fs/${resolve('src/lang/en/setup.json').replaceAll('\\','/')}'
import common from '/@fs/${resolve('src/lang/en/common.json').replaceAll('\\','/')}'
import base from '/@fs/${resolve('src/lang/en/base.json').replaceAll('\\','/')}'
import './styles/app.css'
import './styles/services.css'
import './styles/startup-groups.css'
const messages={setup,common,base}
applyLanguagePayload({locale:'en',fallbackLocale:'en',messages,fallbackMessages:messages})
await localForage.setItem('qtenvdev-customer-module',[])
await localForage.setItem('qtenvdev-customer-module-cate',[])
navigateNext('settings')
const app=createApp(AppNext)
app.use(createPinia())
app.config.warnHandler=message=>fixtureWarnings.push(message)
app.config.errorHandler=error=>fixtureErrors.push(error?.stack||String(error))
app.mount('#app')
window.fixture={controller,async reopen(){navigateNext('custom-modules');await nextTick();navigateNext('settings');await nextTick()},openGroups(){window.Server.isWindows=false;navigateNext('startup-groups')},openSettings(){window.Server.isWindows=true;navigateNext('settings')},async persisted(){return await localForage.getItem('qtenvdev-customer-module')},async categories(){return await localForage.getItem('qtenvdev-customer-module-cate')}}
window.fixtureReady=true
`
const bootstrap = `window.fixtureErrors=[];window.fixtureWarnings=[];window.fixtureServiceActions=[];window.Server={isWindows:true,BaseDir:'C:/fixture/',Static:'C:/fixture/',AppDir:'C:/fixture/',SetupDir:'C:/fixture/'};
window.addEventListener('error',e=>fixtureErrors.push(e.error?.stack||String(e.message)));window.addEventListener('unhandledrejection',e=>fixtureErrors.push(e.reason?.stack||String(e.reason)));let receive;window.QTEnvDevNodeAPI={ipcReceiveFromMain(fn){receive=fn},ipcSendToMain(command,key,...args){let data=command==='App-Node-FN'?false:{code:0,data:[]};if(command==='app-fork:module-customer'){fixtureServiceActions.push(args[0]);if(args[0]==='startService')data={code:0,data:{'APP-Service-Start-PID':4242}};}queueMicrotask(()=>receive?.({},command,key,data));}};`
try {
  await writeFile(fixturePath, '<!doctype html><html class="dark"><head><meta charset="utf-8"></head><body><div id="app"></div><script>' + bootstrap + '</script><script type="module">' + source + '</script></body></html>')
  await server.listen()
  const port = (server.httpServer!.address() as { port: number }).port
  const checks = `(async()=>{
    const wait=async(fn)=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,25))}throw new Error('UI wait timed out: '+document.body.innerText.slice(0,800)+' errors='+JSON.stringify(fixtureErrors))};
    const click=(text,scope=document)=>{const target=[...scope.querySelectorAll('button')].find(button=>button.textContent.trim()===text);if(!target)throw new Error('Button missing: '+text);target.click()};
    const openSettings=()=>{const target=[...document.querySelectorAll('.settings-nav button')].find(button=>button.textContent.includes('Custom modules'));if(!target)throw new Error('Settings entry missing');target.click()};
    const input=(element,value)=>{element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}))};
    await wait(()=>window.fixtureReady);openSettings();await wait(()=>fixture.controller.ready);
    if([...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Save changes'))throw new Error('Generic Settings save exposed in Custom modules');
    click('Add category');await wait(()=>document.querySelector('#custom-module-category input'));input(document.querySelector('#custom-module-category input'),'Workers');document.querySelector('#custom-module-category').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await wait(()=>!document.querySelector('#custom-module-category'));
    click('Add module');await wait(()=>document.querySelector('.el-drawer input[placeholder="Module Name"]')||document.querySelector('.el-drawer .main > input'));
    let drawer=document.querySelector('.el-drawer');input(drawer.querySelector('.main > input'),'Fixture module');
    const addCommand=drawer.querySelector('button[aria-label$=": Add"]');
    if(!addCommand)throw new Error('Command add action missing');addCommand.click();
    await wait(()=>document.querySelectorAll('.el-drawer').length===2);
    const commandDrawer=[...document.querySelectorAll('.el-drawer')].at(-1);input(commandDrawer.querySelector('input'),'Fixture command');input(commandDrawer.querySelector('textarea'),'echo fixture');click('Save',commandDrawer);await wait(()=>document.querySelectorAll('.el-drawer').length===1);
    drawer=document.querySelector('.el-drawer');await wait(()=>[...drawer.querySelectorAll('input')].some(input=>input.value==='Fixture command'));click('Save',drawer);await wait(()=>!document.querySelector('.el-drawer'));await wait(()=>fixture.controller.modules.length===1);
    const stored=await fixture.persisted();if(stored[0].label!=='Fixture module'||stored[0].item[0].name!=='Fixture command')throw new Error('Legacy storage mismatch');
    await fixture.reopen();openSettings();await wait(()=>document.body.innerText.includes('Fixture module'));click('Edit');await wait(()=>document.querySelector('.el-drawer'));
    drawer=document.querySelector('.el-drawer');input(drawer.querySelector('.main > input'),'Canceled module');drawer.querySelector('.nav .left').click();await wait(()=>!document.querySelector('.el-drawer'));if(fixture.controller.modules[0].label!=='Fixture module')throw new Error('Canceled editor mutated saved module');
    click('Edit');await wait(()=>document.querySelector('.el-drawer'));drawer=document.querySelector('.el-drawer');input(drawer.querySelector('.main > input'),'Updated module');click('Save',drawer);await wait(()=>!document.querySelector('.el-drawer'));await wait(()=>fixture.controller.modules[0].label==='Updated module');
    const moduleNav=[...document.querySelectorAll('.sidebar .nav-item')].find(button=>button.textContent.includes('Custom modules'));if(!moduleNav)throw new Error('Custom modules sidebar entry missing');moduleNav.click();await wait(()=>document.querySelector('.custom-modules-screen')?.textContent.includes('Fixture command'));const selectedModule=document.querySelector('.custom-module-picker button[aria-pressed="true"]');if(!selectedModule?.textContent.includes('Updated module'))throw new Error('Saved module was not selected in the workspace');
    const commandRow=document.querySelector('.custom-modules-screen .custom-command');click('Start',commandRow);await wait(()=>commandRow.textContent.includes('Running'));click('Stop',commandRow);await wait(()=>commandRow.textContent.includes('Stopped'));if(fixtureServiceActions.join(',')!=='startService,stopService')throw new Error('Sidebar controls did not use the existing custom service lifecycle');
    fixture.openGroups();await wait(()=>document.querySelector('.startup-groups-screen'));click('+ New group');await wait(()=>[...document.querySelectorAll('.candidate-row')].some(row=>row.textContent.includes('Fixture command')));
    const candidate=[...document.querySelectorAll('.candidate-row')].find(row=>row.textContent.includes('Fixture command'));candidate.click();input(document.querySelector('.startup-editor input[type=text], .startup-editor input:not([type])'),'Custom startup');await wait(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Save group'&&!button.disabled));click('Save group');await wait(()=>document.querySelector('.startup-group-card')?.textContent.includes('Updated module'));
    fixture.openSettings();await wait(()=>document.querySelector('.settings-nav'));openSettings();await wait(()=>document.body.innerText.includes('Updated module'));
    click('Remove');await wait(()=>document.querySelector('.forge-dialog'));click('Remove',document.querySelector('.forge-dialog'));await wait(()=>fixture.controller.modules.length===0);
    fixture.openGroups();await wait(()=>document.querySelector('.startup-group-card')?.textContent.includes('Unavailable'));
    if(fixtureErrors.length)throw new Error(fixtureErrors.join('\\n'));const warnings=fixtureWarnings.filter(x=>/Failed to resolve component|Unhandled error/.test(x));if(warnings.length)throw new Error(warnings.join('\\n'));
    return {categoryPersisted:(await fixture.categories())[0].label,moduleCreation:true,commandDraft:true,reentry:true,cancelPreservesDefinition:true,edit:true,remove:true,groupPicker:true,sidebar:true,storedAfterRemove:await fixture.persisted(),warnings:fixtureWarnings};
  })()`
  const mainPath = join(root, 'main.cjs')
  const main = `const {app,BrowserWindow}=require('electron');const fs=require('node:fs/promises');app.setPath('userData',${JSON.stringify(join(root,'profile'))});app.whenReady().then(async()=>{const win=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{contextIsolation:false,sandbox:false,backgroundThrottling:false}});try{await win.loadURL('http://127.0.0.1:${port}/render-next/.custom-modules-ui-fixture.html');const result=await win.webContents.executeJavaScript(${JSON.stringify(checks)});await fs.writeFile(${JSON.stringify(resultPath)},JSON.stringify(result));console.log('CUSTOM_MODULES_UI='+JSON.stringify(result));app.exit(0)}catch(error){console.error(error.stack||error);app.exit(1)}})`
  await writeFile(mainPath, main)
  const exit = await new Promise<number | null>((resolveExit, reject) => {
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(String(electron), [mainPath], { stdio: 'inherit', env })
    child.on('error', reject)
    child.on('exit', resolveExit)
  })
  assert.equal(exit, 0)
  const result = JSON.parse(await readFile(resultPath,'utf8'))
  assert.equal(result.reentry, true)
  assert.equal(result.groupPicker, true)
  assert.equal(result.sidebar, true)
  assert.deepEqual(result.storedAfterRemove, [])
} finally {
  await server.close()
  await rm(fixturePath, { force: true })
  await rm(root, { recursive: true, force: true })
}
