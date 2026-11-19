import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import electron from 'electron'
import viteConfig from '../configs/vite.config'

const temp = await mkdtemp(join(tmpdir(), 'pqt-capturer-renderer-'))
const evidence = resolve('.superpowers', 'capturer-renderer')
await mkdir(evidence, { recursive: true })
const server = await createServer({
  ...viteConfig.serverConfig,
  configFile: false,
  server: { port: 0, host: '127.0.0.1' },
  plugins: [...(viteConfig.serverConfig.plugins || []), {
    name: 'capturer-renderer-test-ipc',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{ tag: 'script', children: `window.fixtureErrors=[];window.fixtureRequests=[];window.fixturePending=[];window.addEventListener('error',e=>fixtureErrors.push(String(e.error||e.message)));window.addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));window.Server={isWindows:true};let receive;window.QTEnvDevNodeAPI={ipcReceiveFromMain(fn){receive=fn},ipcSendToMain(command,key,...args){fixtureRequests.push({command,key,args});if(command==='Capturer:saveImage'){fixturePending.push({command,key,args});return}queueMicrotask(()=>receive?.({},command,key,{code:0,data:true}));}};window.fixtureReply=(response)=>{const request=fixturePending.shift();if(!request)throw new Error('No pending capture save');receive({},request.command,request.key,response)};`, injectTo: 'head-prepend' }]
    }
  }]
})
try {
  await server.listen()
  const port = (server.httpServer!.address() as { port: number }).port
  const checks = `(async()=>{
    const wait=async(fn)=>{for(let i=0;i<600;i++){if(fn())return;await new Promise(r=>setTimeout(r,25))}throw new Error('Overlay wait timed out '+JSON.stringify(fixtureErrors))};
    await wait(()=>document.querySelector('.main'));
    const {CapturerStore,ScreenStore,capturerSaveOperation}=await import('/render/capturer/store/app.ts');
    const {default:RectSelect}=await import('/render/capturer/RectSelector/RectSelect.ts');
    const store=CapturerStore();
    const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,4,4);ctx.fillStyle='#0000ff';ctx.fillRect(2,2,2,2);
    ScreenStore.canvas=canvas;store.scaleFactor=1;RectSelect.editRect={x:2,y:2,width:2,height:2};RectSelect.editRectId=-1;
    const exported=await store.exportCanvasToBase64();const image=new Image();image.src=exported;await image.decode();if(image.naturalWidth!==2||image.naturalHeight!==2)throw new Error('Wrong full-screen region dimensions');const verify=document.createElement('canvas');verify.width=2;verify.height=2;verify.getContext('2d').drawImage(image,0,0);const pixel=[...verify.getContext('2d').getImageData(0,0,1,1).data];if(JSON.stringify(pixel)!==JSON.stringify([0,0,255,255]))throw new Error('Wrong region pixels '+pixel);
    const first=store.saveImage(true);const duplicate=store.saveImage(false);await wait(()=>fixturePending.length===1);if(!capturerSaveOperation.busy)throw new Error('Overlay cleared busy before native terminal');if(fixtureRequests.filter(x=>x.command==='Capturer:saveImage').length!==1)throw new Error('Duplicate native save');fixtureReply({code:0,data:{id:'fixture',status:'saved',path:'fixture.png'}});if(!await first||!await duplicate)throw new Error('Successful save did not return true');
    RectSelect.editRect={x:0,y:0,width:0,height:2};if(await store.saveImage(true)!==false||!capturerSaveOperation.error.includes('nonempty'))throw new Error('Empty selection was not rejected');
    RectSelect.editRect={x:0,y:0,width:2,height:2};const failed=store.saveImage(true);await wait(()=>fixturePending.length===1);fixtureReply({code:1,msg:'fixture write failed'});if(await failed!==false||!capturerSaveOperation.error.includes('fixture write failed'))throw new Error('Save failure was not surfaced');
    if(fixtureErrors.length)throw new Error(fixtureErrors.join('\\n'));
    return {success:true,region:{width:image.naturalWidth,height:image.naturalHeight,pixel},saveRequests:fixtureRequests.filter(x=>x.command==='Capturer:saveImage').length,tests:['real overlay modules mounted','full-screen region exports canvas pixels','duplicate export/native request guarded','native save result awaited','empty selection rejected','write failure surfaced'],limitations:['IPC replies use an isolated fixture.','Interactive native selection and Save As acceptance were not exercised.']};})()`
  const main = `const {app,BrowserWindow}=require('electron');const fs=require('node:fs/promises');app.setPath('userData',${JSON.stringify(join(temp, 'profile'))});app.whenReady().then(async()=>{const win=new BrowserWindow({show:false,width:800,height:600,webPreferences:{contextIsolation:false,sandbox:true}});win.webContents.on('console-message',event=>console.log(event.message));try{await win.loadURL('http://127.0.0.1:${port}/render/capturer/capturer.html');const result=await win.webContents.executeJavaScript(${JSON.stringify(checks)});await fs.writeFile(${JSON.stringify(join(evidence, 'result.json'))},JSON.stringify(result,null,2));console.log('CAPTURER_RENDERER_PASS');app.exit(0)}catch(error){console.error(error);await fs.writeFile(${JSON.stringify(join(evidence, 'failure.txt'))},String(error.stack||error));app.exit(1)}});setTimeout(()=>app.exit(2),90000)`
  await writeFile(join(temp, 'main.cjs'), main)
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = await new Promise<{ code: number | null; output: string }>((resolveResult, reject) => {
    const child = spawn(String(electron), [join(temp, 'main.cjs')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (data) => { output += data }); child.stderr.on('data', (data) => { output += data })
    child.once('error', reject); child.once('close', (code) => resolveResult({ code, output }))
  })
  await writeFile(join(evidence, 'electron.log'), result.output)
  assert.equal(result.code, 0, result.output.slice(-12000))
  await rm(join(evidence, 'failure.txt'), { force: true })
  console.log('Actual Capturer renderer export/save fixture passed; evidence: ' + evidence)
} finally { await server.close(); await rm(temp, { recursive: true, force: true }) }
