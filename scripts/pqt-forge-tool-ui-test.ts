import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import electron from 'electron'
import viteConfig from '../configs/vite.config'

// Real Vue surfaces/Monaco/Element Plus in Electron; IPC is an isolated fixture.
// No host tools, settings, processes or user files are modified by this harness.
const root = await mkdtemp(join(tmpdir(), 'pqt-tool-ui-'))
const resultDir = resolve('.superpowers/phase3-ui')
await mkdir(resultDir, { recursive: true })
const fixturePath = resolve('src/render-next/.phase3-ui-fixture.html')
const server = await createServer({ ...viteConfig.serverConfig, configFile: false, server: { port: 0, host: '127.0.0.1' } })
const source = `import {createApp,ref,h,nextTick} from 'vue'
import {createPinia} from 'pinia'
import LegacyToolPanel from './components/LegacyToolPanel.vue'
import ImageCompressPanel from './components/ImageCompressPanel.vue'
import ProcessPanel from './components/ProcessPanel.vue'
import CapturerPanel from './components/CapturerPanel.vue'
import SiteSuckerPanel from './components/SiteSuckerPanel.vue'
import CustomToolPanel from './components/CustomToolPanel.vue'
import {toolLibraryController} from './state/toolLibraryController'
import './styles/app.css'
const active=ref('jwt'), shown=ref(true)
const app=createApp({setup:()=>()=>shown.value?h(active.value==='image-compress'?ImageCompressPanel:active.value==='process'?ProcessPanel:active.value==='capturer'?CapturerPanel:active.value==='site-sucker'?SiteSuckerPanel:active.value==='custom'?CustomToolPanel:LegacyToolPanel,{tool:active.value,onClose:()=>{shown.value=false}}):null})
app.use(createPinia());app.config.warnHandler=(message)=>window.fixtureWarnings.push(message);app.config.errorHandler=(error)=>window.fixtureErrors.push(String(error));app.mount('#app')
window.fixture={async open(id){shown.value=false;await nextTick();active.value=id;shown.value=true;await nextTick()},async custom(){toolLibraryController.open({id:'fixture-custom',label:'Fixture',component:location.origin+'/render-next/.phase3-ui-fixture.html?guest'});await this.open('custom')}}
window.fixtureReady=true`
const bootstrap = `window.fixtureErrors=[];window.fixtureWarnings=[];window.Server={isWindows:true,BaseDir:'C:/fixture/',Static:'C:/fixture/',AppDir:'C:/fixture/',SetupDir:'C:/fixture/',PhpDir:'C:/fixture/',NodeDir:'C:/fixture/'};window.process={platform:'win32',env:{},arch:'x64'};
window.addEventListener('error',e=>fixtureErrors.push(String(e.error||e.message)));window.addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
let receive;window.QTEnvDevNodeAPI={ipcReceiveFromMain(fn){receive=fn},ipcSendToMain(command,key,...args){let data={code:0,data:[]};if(command==='App-Node-FN'){const [namespace,method]=args;data=method==='existsSync'?false:method==='readFile'?'':method==='readdir'?[]:method==='types'?{}:method==='getConfig'?{setup:{},server:{}}:method==='showOpenDialog'?{canceled:true,filePaths:[]}:method==='shouldUseDarkColors'?true:[];}if(command==='app-sitesucker-status')data={code:0,data:null};if(command==='app-sitesucker-setup')data={commonSetup:{dir:'C:/fixture/'}};if(command==='Capturer:status')data={code:0,data:{id:'',status:'idle'}};queueMicrotask(()=>receive?.({},command,key,data));}};`
try {
  await writeFile(fixturePath, '<!doctype html><html class="dark"><head><meta charset="utf-8"></head><body><div id="app"></div><script>' + bootstrap + '</script><script type="module">' + source + '</script></body></html>')
  await server.listen()
  const port = (server.httpServer!.address() as any).port
  const checks = `(async()=>{
    const wait=async(fn)=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,25))}throw new Error('UI wait timed out: '+document.body.innerText.slice(0,500)+' errors='+JSON.stringify(window.fixtureErrors))};
    await wait(()=>window.fixtureReady);const ids=['jwt','json','code-library','regex-tester','diff','markdown','qrcode','wifi-qrcode','file-info','keycode','cron-parser','timestamp','environment','ssl-maker','bom-clean','php-obfuscator','playground','websocket','process','image-compress','capturer','site-sucker'];const opened=[];
    for(const id of ids){await fixture.open(id);await wait(()=>document.querySelector('[role=dialog]'));await new Promise(r=>setTimeout(r,650));await wait(()=>!document.body.innerText.includes('Loading tool…'));const text=document.body.innerText;if(text.includes('This tool surface is unavailable')||text.includes('Failed to fetch dynamically'))throw new Error(id+': '+text);const unknown=[...document.querySelectorAll('el-input,el-button,el-select,el-tabs,el-checkbox')];if(unknown.length)throw new Error(id+': unresolved ElementPlus tags');opened.push({id,controls:document.querySelectorAll('input,textarea,button,select').length,text:text.slice(0,160)});}
    if(fixtureErrors.length)throw new Error(fixtureErrors.join('\\n'));const failures=fixtureWarnings.filter(x=>/Failed to resolve component|Unhandled error/.test(x));if(failures.length)throw new Error(failures.join('\\n'));return {opened,warnings:fixtureWarnings};})()`
  const main = `const {app,BrowserWindow}=require('electron')
const fs=require('node:fs/promises')
app.setPath('userData',${JSON.stringify(join(root,'profile'))})
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{contextIsolation:false,sandbox:false,webviewTag:true}})
  await win.loadURL('http://127.0.0.1:${port}/render-next/.phase3-ui-fixture.html')
  try {
    const result=await win.webContents.executeJavaScript(${JSON.stringify(checks)})
    for (const id of ['jwt','json','image-compress','site-sucker']) {
      await win.webContents.executeJavaScript('fixture.open('+JSON.stringify(id)+').then(()=>new Promise(r=>setTimeout(r,700)))')
      await fs.writeFile(${JSON.stringify(resultDir)}+'/'+id+'.png',(await win.webContents.capturePage()).toPNG())
    }
    await fs.writeFile(${JSON.stringify(join(resultDir,'result.json'))},JSON.stringify(result,null,2))
    console.log('TOOL_UI_RESULT='+JSON.stringify(result));app.exit(0)
  } catch(error) {
    console.error(error)
    await fs.writeFile(${JSON.stringify(join(resultDir,'failed.png'))},(await win.webContents.capturePage()).toPNG());app.exit(1)
  }
})
setTimeout(()=>app.exit(2),120000)`
  await writeFile(join(root, 'main.cjs'), main)
  const result = await new Promise<{ code: number | null; output: string }>((resolveResult, reject) => {
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(String(electron), [join(root, 'main.cjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (data) => { output += data }); child.stderr.on('data', (data) => { output += data })
    child.once('error', reject); child.once('close', (code) => resolveResult({ code, output }))
  })
  await writeFile(join(resultDir, 'app.log'), result.output)
  assert.equal(result.code, 0, result.output.slice(-20000))
  console.log(result.output.split('\n').filter((line) => line.includes('TOOL_UI_RESULT=')).join('\n'))
} finally { await server.close(); await rm(fixturePath, { force: true }); await rm(root, { recursive: true, force: true }) }
