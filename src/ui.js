
(()=>{"use strict";
const $=id=>document.getElementById(id);
const state={bg:"transparent",target:"live2d",mirror:true,guide:false,watermark:true,badge:true,
transforms:{live2d:{x:0,y:0,scale:1,rot:0},arms:{x:0,y:0,scale:1,rot:0}},slots:{},live2dPath:null,vrmPath:null,bgmId:null,bgmPath:null};
let stream=null;

const fileUrl=p=>"file:///"+String(p).replace(/\\/g,"/");
const base=p=>p?String(p).split(/[\\/]/).pop():"未選択";
function toast(t){let e=$("toast");if(!e){e=document.createElement("div");e.id="toast";e.className="toast";document.body.appendChild(e)}e.textContent=t;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),1800)}
async function safe(name,fn){try{return await fn()}catch(e){console.error(name,e);window.halAPI.writeLog("[UI] "+name+": "+(e.stack||e)).catch(()=>{});toast(name+"に失敗しました");}}
async function loadScript(src,key){if(window[key])return true;await new Promise((ok,ng)=>{const s=document.createElement("script");s.src=src+"?rc3";s.onload=ok;s.onerror=ng;document.head.appendChild(s)});return !!window[key]}

async function ensureTracking(){
  if(window.HALTracking)return true;
  const ok = await loadScript("./engine-tracking.bundle.js","HALTracking");
  if(ok && window.HALTracking?.prepare){
    await window.HALTracking.prepare({
      canvas:$("threeCanvas"),
      getMirror:()=>state.mirror,
      getTransform:()=>state.transforms.arms
    });
  }
  return ok;
}
async function ensureLive2D(){
  if(window.HALLive2D)return true;
  const core=await window.halAPI.getCorePath();
  if(!core){$("firstRun").classList.remove("hidden");return false}
  if(!window.Live2DCubismCore){
    await new Promise((ok,ng)=>{const s=document.createElement("script");s.src=fileUrl(core);s.onload=ok;s.onerror=ng;document.head.appendChild(s)});
  }
  return loadScript("./engine-live2d.bundle.js","HALLive2D");
}

async function refreshCameras(){
  try{
    if(!navigator.mediaDevices?.enumerateDevices){
      $("cameraSelect").innerHTML='<option value="">カメラAPI非対応</option>';
      return;
    }
    const ds=await navigator.mediaDevices.enumerateDevices();
    const cams=ds.filter(x=>x.kind==="videoinput");
    $("cameraSelect").innerHTML=cams.length
      ? cams.map((c,i)=>`<option value="${c.deviceId}">${c.label||"Camera "+(i+1)}</option>`).join("")
      : '<option value="">デフォルトカメラを使用</option>';
  }catch(e){
    console.warn("enumerateDevices failed",e);
    $("cameraSelect").innerHTML='<option value="">デフォルトカメラを使用</option>';
  }
}
async function camera(){
  if(stream){
    stream.getTracks().forEach(x=>x.stop());
    stream=null;
    $("webcam").srcObject=null;
    $("cameraBtn").textContent="カメラ開始";
    $("emptyHint").style.display="flex";
    toast("カメラを停止しました");
    return;
  }

  const selected=$("cameraSelect").value;
  let lastError=null;

  const attempts = [
    selected ? {video:{deviceId:{exact:selected},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60}},audio:false} : null,
    {video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false},
    {video:true,audio:false}
  ].filter(Boolean);

  for(const constraints of attempts){
    try{
      stream=await navigator.mediaDevices.getUserMedia(constraints);
      break;
    }catch(e){
      lastError=e;
      console.warn("camera attempt failed",e);
    }
  }

  if(!stream){
    const detail = lastError ? `${lastError.name}: ${lastError.message}` : "Unknown error";
    throw new Error(
      "カメラを開始できませんでした。
"+
      detail+
      "
Windowsの 設定 → プライバシーとセキュリティ → カメラ で「デスクトップ アプリがカメラにアクセスできるようにする」がONか確認してください。"
    );
  }

  $("webcam").srcObject=stream;
  await $("webcam").play();
  $("cameraBtn").textContent="カメラ停止";
  $("emptyHint").style.display="none";
  toast("カメラを開始しました");

  safe("トラッキング",async()=>{
    if(await ensureTracking()){
      await window.HALTracking.init({
        video:$("webcam"),
        canvas:$("threeCanvas"),
        getMirror:()=>state.mirror,
        getTransform:()=>state.transforms.arms
      });
      window.HALTracking.start();
    }
  });
}

async function loadSlots(){
  const ss=await window.halAPI.getSlots(),w=$("slots");w.innerHTML="";
  for(const s of ss){
    state.slots[s.id]=s.path;
    const e=document.createElement("div");e.className="slot";
    e.innerHTML=`<img src="${fileUrl(s.path)}"><div><b>${s.label}</b><div class="slotActions"><button class="r">差し替え</button><button class="s">別名保存</button><button class="x">初期</button></div></div>`;
    e.querySelector(".r").onclick=async()=>{const p=await window.halAPI.replaceSlot(s.id);if(p)await loadSlots()};
    e.querySelector(".s").onclick=()=>window.halAPI.saveSlotAs(s.id);
    e.querySelector(".x").onclick=async()=>{await window.halAPI.resetSlot(s.id);await loadSlots()};
    w.appendChild(e);
  }
  if(state.slots.brand_left_bottom)$("brandImage").src=fileUrl(state.slots.brand_left_bottom);
  if(state.slots.preview_watermark)$("previewWatermark").src=fileUrl(state.slots.preview_watermark);
  if(state.slots.record_badge)$("previewBadge").src=fileUrl(state.slots.record_badge);
}
async function loadBGM(){
  const lib=await window.halAPI.getBGMLibrary(),q=($("bgmSearch").value||"").toLowerCase(),w=$("bgmLibrary");w.innerHTML="";
  for(const i of lib.filter(x=>x.name.toLowerCase().includes(q))){
    const e=document.createElement("div");e.className="bgmItem";
    e.innerHTML=`<button class="pick">${i.name}</button><button class="del">×</button>`;
    e.querySelector(".pick").onclick=()=>{state.bgmId=i.id;state.bgmPath=i.path;$("audio").src=fileUrl(i.path);$("bgmName").textContent=i.name};
    e.querySelector(".del").onclick=async()=>{await window.halAPI.removeBGM(i.id);await loadBGM()};
    w.appendChild(e);
  }
}
function bind(){
  $("pickLive2D").onclick=()=>safe("Live2D選択",async()=>{
    const selected=await window.halAPI.pickModel();
    if(!selected)return;
    state.live2dPath=selected.path;
    state.live2dUrl=selected.url;
    $("live2dPath").textContent=base(selected.path);

    if(await ensureLive2D()){
      await window.HALLive2D.load({
        path:selected.path,
        url:selected.url,
        canvas:$("live2dCanvas"),
        getTransform:()=>state.transforms.live2d
      });
      toast("Live2Dを読み込みました");
    }
  });
  $("pickVRM").onclick=()=>safe("3D腕選択",async()=>{
  const p=await window.halAPI.pickVRM();
  if(!p)return;
  state.vrmPath=p;
  $("vrmPath").textContent=base(p);
  if(await ensureTracking()){
    await window.HALTracking.loadVRM?.(p);
    toast("3D腕を読み込みました");
  }
});
  $("cameraBtn").onclick=()=>safe("カメラ",camera);
  $("calibrateBtn").onclick=()=>{state.transforms.arms={x:0,y:0,scale:1,rot:0};window.HALTracking?.calibrate?.()};
  $("smooth").oninput=e=>$("smoothOut").value=Number(e.target.value).toFixed(2);
  $("guideOn").onchange=e=>state.guide=e.target.checked;$("mirrorOn").onchange=e=>state.mirror=e.target.checked;
  $("watermarkOn").onchange=e=>$("previewWatermark").style.display=e.target.checked?"block":"none";
  $("badgeOn").onchange=e=>$("previewBadge").style.display=e.target.checked?"block":"none";
  document.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>{state.bg=b.dataset.bg;$("stageWrap").dataset.bg=state.bg;document.querySelectorAll("[data-bg]").forEach(x=>x.classList.toggle("active",x===b));toast("背景を変更しました")});
  document.querySelectorAll("[data-ratio]").forEach(b=>b.onclick=()=>{$("stageWrap").style.aspectRatio=b.dataset.ratio.replace(":","/");document.querySelectorAll("[data-ratio]").forEach(x=>x.classList.toggle("active",x===b))});
  document.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{state.target=b.dataset.target;document.querySelectorAll("[data-target]").forEach(x=>x.classList.toggle("active",x===b))});
  document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{const t=state.transforms[state.target],k=b.dataset.move;if(k==="up")t.y-=12;if(k==="down")t.y+=12;if(k==="left")t.x-=12;if(k==="right")t.x+=12;if(k==="center"){t.x=0;t.y=0}window.HALLive2D?.applyTransform?.();window.HALTracking?.applyTransform?.()});
  $("smaller").onclick=()=>{state.transforms[state.target].scale=Math.max(.2,state.transforms[state.target].scale-.05);window.HALLive2D?.applyTransform?.()};
  $("larger").onclick=()=>{state.transforms[state.target].scale=Math.min(3,state.transforms[state.target].scale+.05);window.HALLive2D?.applyTransform?.()};
  $("rotL").onclick=()=>{state.transforms[state.target].rot-=2;window.HALLive2D?.applyTransform?.()};
  $("rotR").onclick=()=>{state.transforms[state.target].rot+=2;window.HALLive2D?.applyTransform?.()};
  $("resetPos").onclick=()=>{state.transforms[state.target]={x:0,y:0,scale:1,rot:0};window.HALLive2D?.applyTransform?.()};
  $("importBGM").onclick=()=>safe("BGM追加",async()=>{await window.halAPI.importBGM();await loadBGM()});
  $("bgmSearch").oninput=loadBGM;$("playBGM").onclick=()=>$("audio").play();$("stopBGM").onclick=()=>{$("audio").pause();$("audio").currentTime=0};
  $("bgmVolume").oninput=e=>{$("audio").volume=Number(e.target.value);$("bgmVolumeOut").value=Math.round(Number(e.target.value)*100)+"%"};
  $("bgmLoop").onchange=e=>$("audio").loop=e.target.checked;
  $("chooseOutput").onclick=()=>safe("保存先",async()=>{const p=await window.halAPI.chooseOutputDir();if(p)$("saveDir").textContent=p});
  $("openOutput").onclick=()=>window.halAPI.openOutputDir();
  $("installCoreBtn").onclick=()=>safe("Cubism Core",async()=>{const p=await window.halAPI.installCore();if(p){$("firstRun").classList.add("hidden");toast("Cubism Coreを登録しました")}});
  $("skipCoreBtn").onclick=()=>$("firstRun").classList.add("hidden");$("coreSettings").onclick=()=>$("firstRun").classList.remove("hidden");
  $("openProject").onclick=()=>safe("開く",async()=>{const d=await window.halAPI.loadProject();if(d)Object.assign(state,d)});
  $("saveProject").onclick=()=>safe("保存",async()=>{const p=await window.halAPI.saveProject(state,false);if(p)toast("保存しました")});
  $("saveAsProject").onclick=()=>safe("名前を付けて保存",async()=>{const p=await window.halAPI.saveProject(state,true);if(p)toast("保存しました")});
}
async function boot(){bind();await loadSlots();await loadBGM();await refreshCameras();const s=await window.halAPI.getSettings();$("saveDir").textContent=s.outputDir||"";const p=await window.halAPI.getPreflight();if(!p.coreInstalled)$("firstRun").classList.remove("hidden");$("statusText").textContent="UI準備OK"}
window.addEventListener("DOMContentLoaded",()=>safe("起動",boot));
})();
