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
await rm(join(resultDir, 'result.json'), { force: true })
const fixturePath = resolve('src/render-next/.phase3-ui-fixture.html')
const guestPath = resolve('src/render-next/.phase3-ui-guest.html')
const server = await createServer({ ...viteConfig.serverConfig, configFile: false, optimizeDeps: { ...viteConfig.serverConfig.optimizeDeps, force: true }, server: { port: 0, host: '127.0.0.1' } })
const source = `import {createApp,ref,h,nextTick} from 'vue'
import {createPinia} from 'pinia'
import LegacyToolPanel from './components/LegacyToolPanel.vue'
import ImageCompressPanel from './components/ImageCompressPanel.vue'
import ProcessPanel from './components/ProcessPanel.vue'
import CapturerPanel from './components/CapturerPanel.vue'
import SiteSuckerPanel from './components/SiteSuckerPanel.vue'
import CustomToolPanel from './components/CustomToolPanel.vue'
import LocalToolPanel from './tools/LocalToolPanel.vue'
import {toolController} from './state/toolController'
const otherPanels=import.meta.glob('./components/*Panel.vue',{eager:true,import:'default'})
const otherNames={'request-time':'RequestTiming','git-cheatsheet':'GitCheatsheet','http-status':'HttpStatus','url-parse':'UrlParse','mime-types':'MimeTypes','regex-cheatsheet':'RegexCheatsheet','base64-file':'Base64File','token':'Token','encryption':'Encryption','chmod':'Chmod','rsa':'Rsa','mysql-code':'MysqlCode'}
import {toolLibraryController} from './state/toolLibraryController'
import {siteSuckerController} from './state/siteSuckerController'
import {ImageBatch} from '/@fs/${resolve('src/render/components/Tools/ImageCompress/setup.ts').replaceAll('\\','/')}'
import localForage from 'localforage'
import {editor as monacoEditor} from 'monaco-editor/esm/vs/editor/editor.api.js'
import {applyLanguagePayload} from '/@fs/${resolve('src/lang/runtime.ts').replaceAll('\\','/')}'
import enTools from '/@fs/${resolve('src/lang/en/tools.json').replaceAll('\\','/')}'
import enBase from '/@fs/${resolve('src/lang/en/base.json').replaceAll('\\','/')}'
import enCommon from '/@fs/${resolve('src/lang/en/common.json').replaceAll('\\','/')}'
import enUtil from '/@fs/${resolve('src/lang/en/util.json').replaceAll('\\','/')}'
import enPhp from '/@fs/${resolve('src/lang/en/php.json').replaceAll('\\','/')}'
import enMenu from '/@fs/${resolve('src/lang/en/menu.json').replaceAll('\\','/')}'
import './styles/app.css'
import './styles/tools.css'
import './styles/websites.css'
import './styles/services.css'
const messages={tools:enTools,base:enBase,common:enCommon,util:enUtil,php:enPhp,menu:enMenu}
applyLanguagePayload({locale:'en',fallbackLocale:'en',messages,fallbackMessages:messages})
const active=ref('jwt'), shown=ref(true)
const localIds=['base64','hash','url','html']
const app=createApp({setup:()=>()=>shown.value?h(localIds.includes(active.value)?LocalToolPanel:otherNames[active.value]?otherPanels['./components/'+otherNames[active.value]+'Panel.vue']:active.value==='image-compress'?ImageCompressPanel:active.value==='process'?ProcessPanel:active.value==='capturer'?CapturerPanel:active.value==='site-sucker'?SiteSuckerPanel:active.value==='custom'?CustomToolPanel:LegacyToolPanel,{key:active.value,...(localIds.includes(active.value)?{tool:toolController.tools.find(tool=>tool.id===active.value)}:!otherNames[active.value]&&!['image-compress','process','capturer','site-sucker','custom'].includes(active.value)?{tool:active.value}:{}),onClose:()=>{shown.value=false}}):null})
app.use(createPinia());app.config.warnHandler=(message)=>window.fixtureWarnings.push(message);app.config.errorHandler=(error)=>window.fixtureErrors.push(error?.stack||String(error));app.mount('#app')
window.fixture={editor:monacoEditor,async close(){shown.value=false;await nextTick()},async open(id){shown.value=false;await nextTick();active.value=id;shown.value=true;await nextTick()},async custom(){toolLibraryController.open({id:'fixture-custom',label:'Fixture',component:location.origin+'/render-next/.phase3-ui-guest.html'});await this.open('custom')},library:toolLibraryController,async settingsRace(){
  await localForage.setItem('qtenvdev-tools-imagecompress-v2',{data:{saveDir:'C:/saved-images',backupDir:'C:/saved-backup',rewrite:false}})
  await localForage.setItem('pqt-forge-site-sucker-config',{data:{dir:'C:/saved-mirror',pageLimit:'/docs',maxPages:17}})
  const original=localForage.getItem.bind(localForage)
  localForage.getItem=async(key,...args)=>{if(['qtenvdev-tools-imagecompress-v2','pqt-forge-site-sucker-config'].includes(key))await new Promise(r=>setTimeout(r,150));return original(key,...args)}
  try{
    await this.open('image-compress');await this.open('jwt');await ImageBatch.save()
    const image=await original('qtenvdev-tools-imagecompress-v2');if(image.data.saveDir!=='C:/saved-images'||ImageBatch.saveDir!=='C:/saved-images')throw new Error('Image close during initialization overwrote saved settings')
    const siteInit=siteSuckerController.init();const siteSave=siteSuckerController.saveConfig();await Promise.all([siteInit,siteSave]);const site=await original('pqt-forge-site-sucker-config');if(site.data.dir!=='C:/saved-mirror'||site.data.maxPages!==17)throw new Error('Mirror save during initialization overwrote saved settings')
    return {imageFolder:image.data.saveDir,mirrorFolder:site.data.dir}
  }finally{localForage.getItem=original}
}}
window.fixtureReady=true`
const bootstrap = `window.fixtureErrors=[];window.fixtureWarnings=[];window.Server={isWindows:true,BaseDir:'C:/fixture/',Static:'C:/fixture/',AppDir:'C:/fixture/',SetupDir:'C:/fixture/',PhpDir:'C:/fixture/',NodeDir:'C:/fixture/'};
window.addEventListener('error',e=>fixtureErrors.push(e.error?.stack||String(e.error||e.message)));window.addEventListener('unhandledrejection',e=>fixtureErrors.push(e.reason?.stack||String(e.reason)));
let receive;window.QTEnvDevNodeAPI={ipcReceiveFromMain(fn){receive=fn},ipcSendToMain(command,key,...args){let data={code:0,data:[]};if(command==='app-fork:tools'&&args[0]==='envPathList')data={code:0,data:{rawPath:'C:/fixture/bin',list:[{path:'C:/fixture/bin',raw:'C:/fixture/bin',error:false}]}};if(command==='App-Node-FN'){const [namespace,method]=args;data=method==='existsSync'?false:method==='readFile'?'':method==='readdir'?[]:method==='types'?{types:{json:'application/json'},extensions:{'application/json':['json']}}:method==='getConfig'?{setup:{},server:{}}:method==='showOpenDialog'?{canceled:true,filePaths:[]}:method==='shouldUseDarkColors'?true:[];}if(command==='app-sitesucker-status')data={code:0,data:null};if(command==='app-sitesucker-setup')data={commonSetup:{dir:'C:/fixture/'}};if(command==='Capturer:status')data={code:0,data:{id:'',status:'idle'}};queueMicrotask(()=>receive?.({},command,key,data));}};`
try {
  await writeFile(fixturePath, '<!doctype html><html class="dark"><head><meta charset="utf-8"></head><body><div id="app"></div><script>' + bootstrap + '</script><script type="module">' + source + '</script></body></html>')
  await writeFile(guestPath, '<!doctype html><html><body><h1>Local custom tool fixture</h1></body></html>')
  await server.listen()
  const port = (server.httpServer!.address() as any).port
  const checks = `(async()=>{
    const wait=async(fn)=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,25))}throw new Error('UI wait timed out: '+document.body.innerText.slice(0,500)+' errors='+JSON.stringify(window.fixtureErrors))};
    await wait(()=>window.fixtureReady);const settingsRace=await fixture.settingsRace();const ids=['jwt','json','code-library','regex-tester','diff','markdown','qrcode','wifi-qrcode','file-info','keycode','cron-parser','timestamp','environment','ssl-maker','bom-clean','php-obfuscator','playground','websocket','process','image-compress','capturer','site-sucker','base64','hash','url','html','request-time','git-cheatsheet','http-status','url-parse','mime-types','regex-cheatsheet','base64-file','token','encryption','chmod','rsa','mysql-code'];const opened=[];
    for(const id of ids){console.log('UI_OPEN='+id);await fixture.open(id);await wait(()=>document.querySelector('[role=dialog],.tool-panel'));await new Promise(r=>setTimeout(r,650));await wait(()=>!document.body.innerText.includes('Loading tool…'));const text=document.body.innerText;if(document.querySelector('.pqt-established-tool > .forge-alert--error')||text.includes('This tool surface is unavailable')||text.includes('Failed to fetch dynamically'))throw new Error(id+': '+text);const unknown=[...document.querySelectorAll('el-input,el-button,el-select,el-tabs,el-checkbox')];if(unknown.length)throw new Error(id+': unresolved ElementPlus tags');opened.push({id,controls:document.querySelectorAll('input,textarea,button,select').length,text:text.slice(0,160)});}
    await fixture.open('json');await wait(()=>document.querySelectorAll('.monaco-editor').length===2);
    const models=fixture.editor.getModels();const input=models.find(model=>/Input\\s+JSON/.test(model.getValue()));if(!input)throw new Error('JSON input editor is absent: '+JSON.stringify(models.map(model=>model.getValue())));input.setValue('{"b":2,"a":1}');await wait(()=>models.some(model=>model!==input&&model.getValue().includes('"b": 2')));
    const icons=[...document.querySelectorAll('.fa-icon use')];if(!icons.length||icons.some(use=>!document.getElementById((use.getAttribute('href')||use.getAttribute('xlink:href')||'').slice(1))))throw new Error('Legacy SVG sprite references do not resolve');if(document.querySelectorAll('[data-pqt-legacy-svg-sprite]').length!==1)throw new Error('Legacy sprite must have one owner');
    await fixture.open('php-obfuscator');await wait(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Advanced Settings')));[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Advanced Settings')).click();await wait(()=>document.querySelector('.el-drawer .monaco-editor'));
    const drawer=document.querySelector('.el-drawer .monaco-editor').getBoundingClientRect();if(drawer.width<200||drawer.height<100)throw new Error('PHP config editor collapsed: '+JSON.stringify(drawer));document.querySelector('.el-drawer .nav .left').click();await wait(()=>!document.querySelector('.el-drawer'));
    await fixture.open('code-library');await wait(()=>document.querySelectorAll('.el-tab-pane:not([style*="display: none"]) .el-button.is-link').length>=2);document.querySelectorAll('.el-tab-pane:not([style*="display: none"]) .el-button.is-link')[1].click();await wait(()=>document.querySelector('.el-dialog textarea'));if(document.querySelectorAll('.el-dialog input,.el-dialog textarea').length<4)throw new Error('Code library add controls missing');[...document.querySelectorAll('.el-dialog button')].find(button=>button.textContent.includes('Cancel')).click();await wait(()=>!document.querySelector('.el-dialog'));
    await fixture.close();await wait(()=>!document.querySelector('[data-pqt-legacy-svg-sprite]'));
    await fixture.custom();await wait(()=>fixture.library.pageStatus==='ready');const view=document.querySelector('webview');if(!view||!view.getURL().endsWith('.phase3-ui-guest.html'))throw new Error('Custom tool guest not loaded');fixture.library.reload();await wait(()=>fixture.library.pageStatus==='ready');await fixture.close();
    if(fixtureErrors.length)throw new Error(fixtureErrors.join('\\n'));const failures=fixtureWarnings.filter(x=>/Failed to resolve component|Unhandled error/.test(x));if(failures.length)throw new Error(failures.join('\\n'));return {opened,warnings:fixtureWarnings,settingsRace,jsonConversion:true,legacySprites:true,phpConfig:true,codeLibraryAdd:true,customWebview:true};})()`
  const main = `const {app,BrowserWindow}=require('electron')
const fs=require('node:fs/promises')
app.setPath('userData',${JSON.stringify(join(root,'profile'))})
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{contextIsolation:false,sandbox:false,webviewTag:true,backgroundThrottling:false}})
  win.webContents.on('console-message',event=>console.log(event.message))
  win.webContents.on('render-process-gone',(_event,details)=>console.log('RENDERER_GONE='+JSON.stringify(details)))
  console.log('UI_LOADING')
  await win.loadURL('http://127.0.0.1:${port}/render-next/.phase3-ui-fixture.html')
  console.log('UI_LOADED')
  try {
    const result=await win.webContents.executeJavaScript(${JSON.stringify(checks)})
    for (const id of ['jwt','json','image-compress','site-sucker']) {
      await win.webContents.executeJavaScript('fixture.open('+JSON.stringify(id)+').then(()=>new Promise(r=>setTimeout(r,700)))')
      await win.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
      const capture=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})
      await fs.writeFile(${JSON.stringify(resultDir)}+'/'+id+'.png',capture.toPNG())
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
  await writeFile(join(resultDir, 'app.log'), result.output.replace(/[ \t]+(?=\r?$)/gm, ''))
  assert.equal(result.code, 0, result.output.slice(-20000))
  await rm(join(resultDir, 'failed.png'), { force: true })
  const line = result.output.split('\n').find((item) => item.startsWith('TOOL_UI_RESULT='))!
  const checked = JSON.parse(line.slice('TOOL_UI_RESULT='.length))
  console.log(`Toolbox Electron UI passed: ${checked.opened.length} panels, JSON conversion, sprites, detached PHP/code dialogs, settings races and custom webview. Evidence: ${resultDir}`)
} finally { await server.close(); await rm(fixturePath, { force: true }); await rm(guestPath, { force: true }); await rm(root, { recursive: true, force: true }) }
