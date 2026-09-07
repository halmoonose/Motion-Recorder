
const { app, BrowserWindow, ipcMain, dialog, shell, session, protocol } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

let mainWindow = null;

const modelRoots = new Map();

function mimeFor(p){
  const ext = path.extname(p).toLowerCase();
  const map = {
    ".json":"application/json; charset=utf-8",
    ".moc3":"application/octet-stream",
    ".png":"image/png",
    ".jpg":"image/jpeg",
    ".jpeg":"image/jpeg",
    ".webp":"image/webp",
    ".wav":"audio/wav",
    ".mp3":"audio/mpeg"
  };
  return map[ext] || "application/octet-stream";
}

function registerModelRoot(modelPath){
  const root = path.dirname(modelPath);
  const id = Buffer.from(root).toString("base64url");
  modelRoots.set(id, root);
  return `halmodel://${id}/${encodeURIComponent(path.basename(modelPath))}`;
}


function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); return p; }
function appDataDir(){ return ensureDir(path.join(app.getPath("userData"), "HAL3LAB")); }
function settingsDir(){ return ensureDir(path.join(appDataDir(), "settings")); }
function userAssetsDir(){ return ensureDir(path.join(appDataDir(), "assets")); }
function bgmDir(){ return ensureDir(path.join(appDataDir(), "bgm")); }
function logsDir(){ return ensureDir(path.join(appDataDir(), "logs")); }
function projectsDir(){ return ensureDir(path.join(appDataDir(), "projects")); }
function recordingsDir(){ return ensureDir(path.join(app.getPath("videos"), "HAL3LAB Recordings")); }
function corePath(){ return path.join(appDataDir(), "live2dcubismcore.min.js"); }
function settingsPath(){ return path.join(settingsDir(), "settings.json"); }

function writeLog(message){
  try{
    const day = new Date().toISOString().slice(0,10);
    const p = path.join(logsDir(), `${day}.log`);
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${message}${os.EOL}`, "utf8");
  }catch{}
}

process.on("uncaughtException", err => writeLog("uncaughtException: " + (err?.stack || err)));
process.on("unhandledRejection", err => writeLog("unhandledRejection: " + (err?.stack || err)));

function readJSON(p, fallback){
  try{ return JSON.parse(fs.readFileSync(p,"utf8")); }catch{ return fallback; }
}
function writeJSON(p, obj){
  fs.writeFileSync(p, JSON.stringify(obj,null,2), "utf8");
}
function readSettings(){
  return readJSON(settingsPath(), {
    firstRun: true,
    outputDir: recordingsDir(),
    bgmLibrary: [],
    recentProjects: []
  });
}
function saveSettings(patch){
  const cur = readSettings();
  const next = {...cur, ...patch};
  writeJSON(settingsPath(), next);
  return next;
}
function slotConfig(){
  const p = path.join(process.resourcesPath, "assets", "slots.json");
  const fallback = path.join(__dirname, "../assets/slots.json");
  return readJSON(fs.existsSync(p)?p:fallback, {slots:[]});
}
function demoAssetPath(file){
  const p = path.join(process.resourcesPath, "assets", "demo", file);
  const fallback = path.join(__dirname, "../assets/demo", file);
  return fs.existsSync(p)?p:fallback;
}
function effectiveSlot(slot){
  const dir=userAssetsDir();
  const candidates=fs.readdirSync(dir).filter(f=>f.startsWith(slot.id+"__"));
  if(candidates.length){
    candidates.sort((a,b)=>fs.statSync(path.join(dir,b)).mtimeMs-fs.statSync(path.join(dir,a)).mtimeMs);
    return path.join(dir,candidates[0]);
  }
  return demoAssetPath(slot.defaultFile);
}
function clearSlot(slotId){
  for(const f of fs.readdirSync(userAssetsDir()).filter(f=>f.startsWith(slotId+"__"))){
    fs.rmSync(path.join(userAssetsDir(),f),{force:true});
  }
}
function copyAsSlot(slotId, src){
  clearSlot(slotId);
  const ext = path.extname(src).toLowerCase() || ".png";
  const dst = path.join(userAssetsDir(), `${slotId}__custom${ext}`);
  fs.copyFileSync(src,dst);
  return dst;
}
function copyBGM(src){
  const ext = path.extname(src).toLowerCase();
  const safe = path.basename(src,ext).replace(/[\\/:*?"<>|]/g,"_");
  let dst = path.join(bgmDir(), `${safe}${ext}`);
  let i=2;
  while(fs.existsSync(dst)){
    dst = path.join(bgmDir(), `${safe}_${i}${ext}`);
    i++;
  }
  fs.copyFileSync(src,dst);
  return dst;
}
function buildPreflight(){
  const s=readSettings();
  return {
    coreInstalled: fs.existsSync(corePath()),
    outputDir: s.outputDir || recordingsDir(),
    outputWritable: (()=>{try{ensureDir(s.outputDir||recordingsDir()); const t=path.join(s.outputDir||recordingsDir(),".write-test");fs.writeFileSync(t,"ok");fs.rmSync(t);return true}catch{return false}})(),
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion()
  };
}

function createWindow(){
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#f7f5fb",
    show: false,
    webPreferences: {
      preload: path.join(__dirname,"preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false
    }
  });
  mainWindow.once("ready-to-show",()=>mainWindow.show());
  mainWindow.webContents.on("render-process-gone", (_e, details)=>{
    writeLog("renderer gone: "+JSON.stringify(details));
  });
  mainWindow.loadFile(path.join(__dirname,"index.html"));
}


protocol.registerSchemesAsPrivileged([
  {
    scheme: "halmodel",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

app.whenReady().then(async()=>{
  const allowedPermissions = new Set(["media","microphone","camera","audioCapture","videoCapture"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback)=>{
    callback(allowedPermissions.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission)=>{
    return allowedPermissions.has(permission);
  });

  protocol.handle("halmodel", async (request)=>{
    try{
      const u = new URL(request.url);
      const id = u.hostname;
      const root = modelRoots.get(id);
      if(!root) return new Response("Unknown model root",{status:404});

      const rel = decodeURIComponent(u.pathname.replace(/^\//,""));
      const normalized = path.normalize(rel);
      const local = path.resolve(root, normalized);
      const rootResolved = path.resolve(root) + path.sep;

      if(!(local + path.sep).startsWith(rootResolved) && local !== path.resolve(root)){
        return new Response("Forbidden",{status:403});
      }
      if(!fs.existsSync(local) || fs.statSync(local).isDirectory()){
        return new Response("Not found",{status:404});
      }

      const data = fs.readFileSync(local);
      return new Response(data,{
        status:200,
        headers:{
          "Content-Type": mimeFor(local),
          "Access-Control-Allow-Origin":"*",
          "Cache-Control":"no-cache"
        }
      });
    }catch(e){
      writeLog("halmodel protocol error: "+(e.stack||e));
      return new Response("Protocol error",{status:500});
    }
  });

  ipcMain.handle("get-preflight",()=>buildPreflight());
  ipcMain.handle("get-settings",()=>readSettings());
  ipcMain.handle("save-settings",(_e,patch)=>saveSettings(patch));
  ipcMain.handle("get-core-path",()=>fs.existsSync(corePath())?corePath():null);
  ipcMain.handle("install-core",async()=>{
    const r=await dialog.showOpenDialog({
      title:"live2dcubismcore.min.js を選択",
      properties:["openFile"],
      filters:[{name:"Live2D Cubism Core",extensions:["js"]}]
    });
    if(r.canceled) return null;
    const src=r.filePaths[0];
    if(path.basename(src).toLowerCase()!=="live2dcubismcore.min.js"){
      throw new Error("live2dcubismcore.min.js を選択してください。");
    }
    fs.copyFileSync(src,corePath());
    saveSettings({firstRun:false});
    writeLog("Cubism Core installed.");
    return corePath();
  });
  ipcMain.handle("remove-core",()=>{
    fs.rmSync(corePath(),{force:true});
    return true;
  });

  ipcMain.handle("pick-model",async()=>{
    const r=await dialog.showOpenDialog({
      title:"Live2D model3.json",
      properties:["openFile"],
      filters:[{name:"Live2D model3.json",extensions:["json"]}]
    });
    if(r.canceled)return null;
    const p=r.filePaths[0];
    const name=path.basename(p).toLowerCase();
    if(!name.endsWith(".model3.json")){
      throw new Error(".model3.json を選択してください。");
    }
    const url=registerModelRoot(p);
    writeLog("Live2D model root registered: "+p);
    return {path:p,url};
  });
  ipcMain.handle("register-model-path",(_e,p)=>{
    if(!p || !fs.existsSync(p))throw new Error("Live2Dモデルが見つかりません。");
    return registerModelRoot(p);
  });

  ipcMain.handle("pick-vrm",async()=>{
    const r=await dialog.showOpenDialog({
      title:"3D腕モデル",
      properties:["openFile"],
      filters:[{name:"VRM / GLB",extensions:["vrm","glb","gltf"]}]
    });
    return r.canceled?null:r.filePaths[0];
  });

  ipcMain.handle("get-slots",()=>slotConfig().slots.map(s=>({...s,path:effectiveSlot(s)})));
  ipcMain.handle("replace-slot",async(_e,id)=>{
    const r=await dialog.showOpenDialog({
      title:"画像を差し替え",
      properties:["openFile"],
      filters:[{name:"Image",extensions:["png","jpg","jpeg","webp"]}]
    });
    if(r.canceled)return null;
    return copyAsSlot(id,r.filePaths[0]);
  });
  ipcMain.handle("save-slot-as",async(_e,id)=>{
    const slot=slotConfig().slots.find(s=>s.id===id);
    if(!slot)return null;
    const src=effectiveSlot(slot);
    const r=await dialog.showSaveDialog({
      title:"画像を別名保存",
      defaultPath:slot.defaultFile,
      filters:[{name:"Image",extensions:["png","jpg","jpeg","webp"]}]
    });
    if(r.canceled||!r.filePath)return null;
    fs.copyFileSync(src,r.filePath);
    return r.filePath;
  });
  ipcMain.handle("reset-slot",(_e,id)=>{
    clearSlot(id);
    const slot=slotConfig().slots.find(s=>s.id===id);
    return slot?effectiveSlot(slot):null;
  });

  ipcMain.handle("import-bgm",async()=>{
    const r=await dialog.showOpenDialog({
      title:"BGMを追加",
      properties:["openFile","multiSelections"],
      filters:[{name:"Audio",extensions:["mp3","wav","m4a","ogg","aac","flac"]}]
    });
    if(r.canceled)return [];
    const imported=[];
    const settings=readSettings();
    const lib=[...(settings.bgmLibrary||[])];
    for(const src of r.filePaths){
      const dst=copyBGM(src);
      const item={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:path.basename(dst),path:dst,addedAt:new Date().toISOString()};
      lib.push(item); imported.push(item);
    }
    saveSettings({bgmLibrary:lib});
    return imported;
  });
  ipcMain.handle("get-bgm-library",()=>readSettings().bgmLibrary||[]);
  ipcMain.handle("remove-bgm",(_e,id)=>{
    const s=readSettings(), lib=[...(s.bgmLibrary||[])];
    const item=lib.find(x=>x.id===id);
    if(item?.path) fs.rmSync(item.path,{force:true});
    const next=lib.filter(x=>x.id!==id);
    saveSettings({bgmLibrary:next});
    return next;
  });

  ipcMain.handle("choose-output-dir",async()=>{
    const s=readSettings();
    const r=await dialog.showOpenDialog({title:"保存先を選択",defaultPath:s.outputDir||recordingsDir(),properties:["openDirectory","createDirectory"]});
    if(r.canceled)return null;
    ensureDir(r.filePaths[0]);
    saveSettings({outputDir:r.filePaths[0]});
    return r.filePaths[0];
  });
  ipcMain.handle("open-output-dir",()=>{
    const s=readSettings();
    return shell.openPath(s.outputDir||recordingsDir());
  });

  ipcMain.handle("save-recording",async(_e, suggested, bytes)=>{
    const s=readSettings();
    const dir=ensureDir(s.outputDir||recordingsDir());
    const out=path.join(dir,suggested);
    fs.writeFileSync(out,Buffer.from(bytes));
    writeLog("Saved recording: "+out);
    return out;
  });
  ipcMain.handle("save-snapshot",async(_e, suggested, bytes)=>{
    const s=readSettings();
    const dir=ensureDir(s.outputDir||recordingsDir());
    const out=path.join(dir,suggested);
    fs.writeFileSync(out,Buffer.from(bytes));
    return out;
  });

  ipcMain.handle("save-project",async(_e,data,saveAs=false)=>{
    const s=readSettings();
    let out=data.projectPath || null;
    if(saveAs || !out){
      const r=await dialog.showSaveDialog({
        title:saveAs?"名前を付けて保存":"プロジェクトを保存",
        defaultPath:path.join(projects(),(data.projectName||"untitled")+".halproj.json"),
        filters:[{name:"HAL Project",extensions:["json"]}]
      });
      if(r.canceled)return null;
      out=r.filePath;
    }
    data.projectPath=out;
    writeJSON(out,data);
    const recent=[out,...(s.recentProjects||[]).filter(x=>x!==out)].slice(0,10);
    saveSettings({recentProjects:recent});
    return out;
  });
  ipcMain.handle("load-project",async()=>{
    const r=await dialog.showOpenDialog({
      title:"プロジェクトを開く",
      defaultPath:projects(),
      properties:["openFile"],
      filters:[{name:"HAL Project",extensions:["json"]}]
    });
    if(r.canceled)return null;
    const data=readJSON(r.filePaths[0],null);
    if(!data)throw new Error("プロジェクトファイルを読み込めませんでした。");
    data.projectPath=r.filePaths[0];
    return data;
  });

  ipcMain.handle("write-log",(_e,msg)=>writeLog(String(msg)));
  ipcMain.handle("open-log-dir",()=>shell.openPath(logsDir()));

  createWindow();
});

app.on("window-all-closed",()=>{ if(process.platform!=="darwin") app.quit(); });
