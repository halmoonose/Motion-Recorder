
const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("halAPI",{
  getPreflight:()=>ipcRenderer.invoke("get-preflight"),
  getSettings:()=>ipcRenderer.invoke("get-settings"),
  saveSettings:p=>ipcRenderer.invoke("save-settings",p),
  getCorePath:()=>ipcRenderer.invoke("get-core-path"),
  installCore:()=>ipcRenderer.invoke("install-core"),
  removeCore:()=>ipcRenderer.invoke("remove-core"),

  pickModel:()=>ipcRenderer.invoke("pick-model"),
  pickVRM:()=>ipcRenderer.invoke("pick-vrm"),

  getSlots:()=>ipcRenderer.invoke("get-slots"),
  replaceSlot:id=>ipcRenderer.invoke("replace-slot",id),
  saveSlotAs:id=>ipcRenderer.invoke("save-slot-as",id),
  resetSlot:id=>ipcRenderer.invoke("reset-slot",id),

  importBGM:()=>ipcRenderer.invoke("import-bgm"),
  getBGMLibrary:()=>ipcRenderer.invoke("get-bgm-library"),
  removeBGM:id=>ipcRenderer.invoke("remove-bgm",id),

  chooseOutputDir:()=>ipcRenderer.invoke("choose-output-dir"),
  openOutputDir:()=>ipcRenderer.invoke("open-output-dir"),
  saveRecording:(name,bytes)=>ipcRenderer.invoke("save-recording",name,bytes),
  saveSnapshot:(name,bytes)=>ipcRenderer.invoke("save-snapshot",name,bytes),

  saveProject:(data,saveAs=false)=>ipcRenderer.invoke("save-project",data,saveAs),
  loadProject:()=>ipcRenderer.invoke("load-project"),

  writeLog:m=>ipcRenderer.invoke("write-log",m),
  openLogDir:()=>ipcRenderer.invoke("open-log-dir")
});
