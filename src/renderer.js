
import * as PIXI from "pixi.js";
import { FilesetResolver, FaceLandmarker, PoseLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

window.PIXI=PIXI;
const $=id=>document.getElementById(id);
const icons={
 folder:'<path d="M3 6h6l2 2h10v10H3z"/><path d="M3 6V4h7l2 2"/>',
 save:'<path d="M5 3h12l3 3v15H4V3z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
 camera:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
 target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
 reset:'<path d="M4 4v6h6"/><path d="M5 10a8 8 0 1 0 2-5"/>',
 play:'<path d="M8 5l11 7-11 7z"/>',
 stop:'<rect x="7" y="7" width="10" height="10"/>'
};
document.querySelectorAll("[data-icon]").forEach(b=>{const svg=`<svg viewBox="0 0 24 24">${icons[b.dataset.icon]||''}</svg>`;b.insertAdjacentHTML("afterbegin",svg)});

const state={
 projectName:"untitled",projectPath:null,live2dPath:null,vrmPath:null,corePath:null,
 target:"live2d",bg:"transparent",ratio:"9:16",countdown:3,
 transforms:{live2d:{x:0,y:0,scale:1,rot:0},arms:{x:0,y:0,scale:1,rot:0}},
 slots:{},guide:false,mirror:true,watermark:true,badge:true,
 bgmId:null,bgmPath:null
};

const video=$("webcam"),comp=$("composite"),ctx=comp.getContext("2d",{alpha:true});
const dbg=$("debugCanvas"),dctx=dbg.getContext("2d");
let stream=null,micStream=null,faceLM=null,poseLM=null,handLM=null,lastV=-1;
let faceRes=null,poseRes=null,handRes=null,l2d=null,Live2DModelClass=null,vrm=null,dummy=true;
let recording=false,recorder=null,chunks=[],recordStart=0;
let audioCtx=null,audioSource=null,audioDest=null,bgmGain=null;
let bgmLibrary=[];

const pixi=new PIXI.Application({view:$("live2dCanvas"),width:1080,height:1920,backgroundAlpha:0,antialias:true});
const threeRenderer=new THREE.WebGLRenderer({canvas:$("threeCanvas"),alpha:true,antialias:true,preserveDrawingBuffer:true});
threeRenderer.setSize(1080,1920,false);threeRenderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(),cam3=new THREE.OrthographicCamera(-1,1,1920/1080,-1920/1080,.01,100);cam3.position.z=5;
scene.add(new THREE.HemisphereLight(0xffffff,0x555566,3));const dl=new THREE.DirectionalLight(0xffffff,3);dl.position.set(2,4,5);scene.add(dl);const dummyGroup=new THREE.Group();scene.add(dummyGroup);

function log(m){console.log(m);window.halAPI.writeLog(m).catch(()=>{})}
function showFatal(m){$("fatalText").textContent=m;$("fatalBanner").classList.remove("hidden");log("FATAL UI: "+m)}
function clearFatal(){$("fatalBanner").classList.add("hidden")}
window.addEventListener("error",e=>showFatal("予期しないエラーが発生しました。ログを確認できます。"));
window.addEventListener("unhandledrejection",e=>showFatal("処理に失敗しました。ログを確認できます。"));
$("openLogs").onclick=()=>window.halAPI.openLogDir();

function fileUrl(p){return "file:///"+p.replace(/\\/g,"/")}
function baseName(p){return p?p.split(/[\\/]/).pop():"未選択"}

async function loadCore(path){
  if(!path)return false;
  if(window.Live2DCubismCore){
    state.corePath=path;
  }else{
    await new Promise((resolve,reject)=>{
      const s=document.createElement("script");s.src=fileUrl(path);s.onload=resolve;s.onerror=()=>reject(new Error("Cubism Coreを読み込めませんでした。"));document.head.appendChild(s);
    });
  }
  const mod=await import("pixi-live2d-display/cubism4");
  Live2DModelClass=mod.Live2DModel;
  state.corePath=path;
  return true;
}
async function firstRun(){
  const pre=await window.halAPI.getPreflight();
  $("saveDir").textContent=pre.outputDir;
  if(pre.coreInstalled){
    const p=await window.halAPI.getCorePath();
    try{await loadCore(p)}catch(e){showFatal(e.message)}
  }else{
    $("firstRun").classList.remove("hidden");
  }
}
$("installCoreBtn").onclick=async()=>{
  try{
    const p=await window.halAPI.installCore();
    if(!p)return;
    await loadCore(p);
    $("firstRun").classList.add("hidden");
    clearFatal();
  }catch(e){alert(e.message)}
};
$("skipCoreBtn").onclick=()=>$("firstRun").classList.add("hidden");
$("coreSettings").onclick=()=>$("firstRun").classList.remove("hidden");

async function loadSlots(){
  const ss=await window.halAPI.getSlots();$("slots").innerHTML="";
  for(const s of ss){
    state.slots[s.id]=s.path;
    const el=document.createElement("div");el.className="slot";
    el.innerHTML=`<img><div><b>${s.label}</b><div class="slotActions"><button data-a="r">差し替え</button><button data-a="s">別名保存</button><button data-a="x">初期</button></div></div>`;
    el.querySelector("img").src=fileUrl(s.path);
    el.querySelector('[data-a=r]').onclick=async()=>{const p=await window.halAPI.replaceSlot(s.id);if(p)await loadSlots()};
    el.querySelector('[data-a=s]').onclick=()=>window.halAPI.saveSlotAs(s.id);
    el.querySelector('[data-a=x]').onclick=async()=>{await window.halAPI.resetSlot(s.id);await loadSlots()};
    $("slots").append(el);
  }
  syncSlotImages();
}
function syncSlotImages(){
  if(state.slots.brand_left_bottom)$("brandImage").src=fileUrl(state.slots.brand_left_bottom);
  if(state.slots.preview_watermark)$("previewWatermark").src=fileUrl(state.slots.preview_watermark);
  if(state.slots.record_badge)$("previewBadge").src=fileUrl(state.slots.record_badge);
  $("previewWatermark").style.display=state.watermark?"block":"none";
  $("previewBadge").style.display=state.badge?"block":"none";
}

async function listCameras(){
  try{
    const ds=await navigator.mediaDevices.enumerateDevices(),cs=ds.filter(d=>d.kind==="videoinput");
    $("cameraSelect").innerHTML=cs.length?cs.map((c,i)=>`<option value="${c.deviceId}">${c.label||"Camera "+(i+1)}</option>`).join(""):"<option value=''>カメラが見つかりません</option>";
  }catch(e){$("cameraSelect").innerHTML="<option>カメラ取得失敗</option>";log(e.message)}
}
async function startCamera(){
  if(stream)return stopCamera();
  stream=await navigator.mediaDevices.getUserMedia({video:{deviceId:$("cameraSelect").value?{exact:$("cameraSelect").value}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60}},audio:false});
  video.srcObject=stream;await video.play();await listCameras();$("cameraBtn").lastChild.textContent="カメラ停止";$("emptyHint").style.display="none";
}
function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null}$("cameraBtn").lastChild.textContent="カメラ開始";$("emptyHint").style.display="flex"}

async function initVision(){
  try{
    const vision=await FilesetResolver.forVisionTasks(new URL("../node_modules/@mediapipe/tasks-vision/wasm",import.meta.url).toString());
    const base="https://storage.googleapis.com/mediapipe-models";
    faceLM=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:`${base}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,delegate:"GPU"},runningMode:"VIDEO",outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true,numFaces:1});
    poseLM=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:`${base}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,delegate:"GPU"},runningMode:"VIDEO",numPoses:1});
    handLM=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:`${base}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,delegate:"GPU"},runningMode:"VIDEO",numHands:2});
  }catch(e){showFatal("トラッカーの初期化に失敗しました。インターネット接続を確認して再起動してください。");log(e.stack||e.message)}
}
async function loadLive2D(path){
  if(!Live2DModelClass)throw new Error("先にCubism Coreを設定してください。");
  if(l2d){pixi.stage.removeChild(l2d);l2d.destroy({children:true})}
  l2d=await Live2DModelClass.from(fileUrl(path),{autoInteract:false});l2d.anchor.set(.5,.5);pixi.stage.addChild(l2d);applyTransforms();
}
async function loadVRM(path){
  const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
  const gltf=await loader.loadAsync(fileUrl(path));if(vrm)scene.remove(vrm.scene);
  vrm=gltf.userData.vrm;scene.add(vrm.scene);dummy=false;applyTransforms();
}
function pset(id,v){try{l2d?.internalModel?.coreModel?.setParameterValueById(id,v)}catch{}}
function blend(n){return faceRes?.faceBlendshapes?.[0]?.categories?.find(c=>c.categoryName===n)?.score||0}
function driveFace(){if(!l2d||!faceRes||!$("faceOn").checked)return;pset("ParamEyeLOpen",1-blend("eyeBlinkLeft"));pset("ParamEyeROpen",1-blend("eyeBlinkRight"));pset("ParamMouthOpenY",Math.min(1,blend("jawOpen")*1.5));pset("ParamMouthForm",Math.min(1,(blend("mouthSmileLeft")+blend("mouthSmileRight"))-.2))}
function world(p){const x=((state.mirror?1-p.x:p.x)-.5)*2,y=(.5-p.y)*2*(comp.height/comp.width),z=-(p.z||0);return new THREE.Vector3(x,y,z)}
function capsule(a,b,r=.055){const mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b),g=new THREE.CapsuleGeometry(r,Math.max(.01,len-r*2),8,14),m=new THREE.MeshStandardMaterial({color:0xffc3da,roughness:.7}),x=new THREE.Mesh(g,m);x.position.copy(mid);x.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return x}
function sphere(p,r=.075){const x=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),new THREE.MeshStandardMaterial({color:0xffc3da,roughness:.7}));x.position.copy(p);return x}
function clearDummy(){while(dummyGroup.children.length){const c=dummyGroup.children.pop();c.geometry?.dispose();c.material?.dispose()}}
function armTransform(v){const t=state.transforms.arms;return v.multiplyScalar(t.scale).applyAxisAngle(new THREE.Vector3(0,0,1),t.rot*Math.PI/180).add(new THREE.Vector3(t.x/500,-t.y/500,0))}
function drawArms(){
  clearDummy();if(!poseRes?.landmarks?.[0]||!$("poseOn").checked||!dummy)return;
  const p=poseRes.landmarks[0];
  for(const [a,b] of [[11,13],[13,15],[12,14],[14,16]])dummyGroup.add(capsule(armTransform(world(p[a])),armTransform(world(p[b]))));
  for(const i of [15,16])dummyGroup.add(sphere(armTransform(world(p[i]))));
  if(handRes?.landmarks&&$("handsOn").checked)for(const h of handRes.landmarks){const w=armTransform(world(h[0]));for(const i of [4,8,12,16,20])dummyGroup.add(capsule(w,armTransform(world(h[i])),.016))}
}
function driveVRM(){if(!vrm||!poseRes?.landmarks?.[0]||!$("poseOn").checked)return;const h=vrm.humanoid,p=poseRes.landmarks[0];for(const [bone,a,b] of [["leftUpperArm",11,13],["leftLowerArm",13,15],["rightUpperArm",12,14],["rightLowerArm",14,16]]){const n=h.getNormalizedBoneNode(bone);if(!n)continue;const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),world(p[b]).sub(world(p[a])).normalize());n.quaternion.slerp(q,1-Number($("smooth").value))}vrm.update(1/60)}
function applyTransforms(){if(l2d){const t=state.transforms.live2d;l2d.x=comp.width/2+t.x;l2d.y=comp.height/2+t.y;l2d.scale.set(t.scale);l2d.rotation=t.rot*Math.PI/180}if(vrm){const t=state.transforms.arms;vrm.scene.position.set(t.x/500,-t.y/500,0);vrm.scene.scale.setScalar(t.scale);vrm.scene.rotation.z=t.rot*Math.PI/180}}
function debug(){dctx.clearRect(0,0,dbg.width,dbg.height);if(!state.guide||!poseRes?.landmarks?.[0])return;const p=poseRes.landmarks[0],cv=x=>({x:(state.mirror?1-x.x:x.x)*dbg.width,y:x.y*dbg.height});dctx.strokeStyle="rgba(126,91,232,.75)";dctx.lineWidth=5;for(const [a,b]of[[11,13],[13,15],[12,14],[14,16],[11,12]]){const A=cv(p[a]),B=cv(p[b]);dctx.beginPath();dctx.moveTo(A.x,A.y);dctx.lineTo(B.x,B.y);dctx.stroke()}}
async function tracking(ts){if(!stream||!video.videoWidth||video.currentTime===lastV||!faceLM)return;lastV=video.currentTime;try{if($("faceOn").checked)faceRes=faceLM.detectForVideo(video,ts);if($("poseOn").checked)poseRes=poseLM.detectForVideo(video,ts);if($("handsOn").checked)handRes=handLM.detectForVideo(video,ts)}catch{}}
function fillBG(){if(state.bg==="transparent")return;ctx.fillStyle=state.bg==="green"?"#00ff00":state.bg==="black"?"#000":"#fff";ctx.fillRect(0,0,comp.width,comp.height)}
function compose(){ctx.clearRect(0,0,comp.width,comp.height);fillBG();ctx.drawImage($("live2dCanvas"),0,0);ctx.drawImage($("threeCanvas"),0,0);if(state.guide)ctx.drawImage(dbg,0,0);if(state.watermark&&state.slots.preview_watermark){const im=$("previewWatermark");if(im.complete)ctx.drawImage(im,comp.width-220,20,200,70)}if(state.badge&&state.slots.record_badge){const im=$("previewBadge");if(im.complete)ctx.drawImage(im,20,comp.height-90,260,65)}}
function loop(ts){tracking(ts);driveFace();if(dummy)drawArms();else driveVRM();threeRenderer.render(scene,cam3);debug();compose();if(recording){const s=(performance.now()-recordStart)/1000;$("timer").textContent=new Date(s*1000).toISOString().slice(11,19);$("meterFill").style.width=(20+Math.random()*60)+"%"}requestAnimationFrame(loop)}
function resize(w,h){for(const c of [comp,$("live2dCanvas"),$("threeCanvas"),dbg]){c.width=w;c.height=h}pixi.renderer.resize(w,h);threeRenderer.setSize(w,h,false);cam3.top=h/w;cam3.bottom=-h/w;cam3.updateProjectionMatrix();applyTransforms()}

async function loadBGMLibrary(){
  bgmLibrary=await window.halAPI.getBGMLibrary();
  renderBGMLibrary();
}
function renderBGMLibrary(){
  const q=$("bgmSearch").value.trim().toLowerCase(),wrap=$("bgmLibrary");wrap.innerHTML="";
  for(const item of bgmLibrary.filter(x=>x.name.toLowerCase().includes(q))){
    const el=document.createElement("div");el.className="bgmItem"+(state.bgmId===item.id?" active":"");
    el.innerHTML=`<button class="pick">${item.name}</button><button class="del">×</button>`;
    el.querySelector(".pick").onclick=()=>selectBGM(item);
    el.querySelector(".del").onclick=async()=>{bgmLibrary=await window.halAPI.removeBGM(item.id);if(state.bgmId===item.id){state.bgmId=null;state.bgmPath=null;$("audio").removeAttribute("src");$("bgmName").textContent="BGMなし"}renderBGMLibrary()};
    wrap.append(el);
  }
}
function selectBGM(item){state.bgmId=item.id;state.bgmPath=item.path;$("audio").src=fileUrl(item.path);$("bgmName").textContent=item.name;renderBGMLibrary()}
$("importBGM").onclick=async()=>{await window.halAPI.importBGM();await loadBGMLibrary()};
$("bgmSearch").oninput=renderBGMLibrary;

async function setupAudio(){if(audioCtx)return;audioCtx=new AudioContext();audioSource=audioCtx.createMediaElementSource($("audio"));bgmGain=audioCtx.createGain();audioDest=audioCtx.createMediaStreamDestination();audioSource.connect(bgmGain);bgmGain.connect(audioCtx.destination);bgmGain.connect(audioDest);bgmGain.gain.value=Number($("bgmVolume").value)}
function fmt(s){return `${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,"0")}`}
$("playBGM").onclick=async()=>{if(!state.bgmPath)return;await setupAudio();await audioCtx.resume();$("audio").play()};
$("stopBGM").onclick=()=>{$("audio").pause();$("audio").currentTime=0};
$("bgmVolume").oninput=e=>{const v=Number(e.target.value);$("bgmVolumeOut").value=Math.round(v*100)+"%";$("audio").volume=v;if(bgmGain)bgmGain.gain.value=v};
$("bgmLoop").onchange=e=>$("audio").loop=e.target.checked;
$("audio").ontimeupdate=()=>{const a=$("audio");$("bgmTime").textContent=`${fmt(a.currentTime)} / ${fmt(a.duration)}`;if(a.duration){$("bgmSeek").value=a.currentTime/a.duration*100;$("bgmSeekOut").value=fmt(a.currentTime)}};
$("bgmSeek").oninput=e=>{const a=$("audio");if(a.duration)a.currentTime=a.duration*Number(e.target.value)/100};

async function preflight(forRecording=false){
  const p=await window.halAPI.getPreflight();const checks=[];
  checks.push({ok:!!stream,label:"カメラ",msg:stream?"接続済み":"未開始"});
  checks.push({ok:!!l2d||dummy||!!vrm,label:"モデル",msg:l2d||vrm?"読込済み":dummy?"簡易3D腕":"未読込"});
  checks.push({ok:p.outputWritable,label:"保存先",msg:p.outputWritable?"書き込みOK":"書き込み不可"});
  checks.push({ok:p.coreInstalled||!state.live2dPath,label:"Cubism Core",msg:p.coreInstalled?"設定済み":state.live2dPath?"必要":"Live2D未使用"});
  renderChecks(checks);
  if(forRecording){
    const fail=checks.filter(x=>!x.ok);
    if(fail.length)throw new Error("録画前チェック: "+fail.map(x=>x.label).join("、")+"を確認してください。");
  }
  return checks;
}
function renderChecks(cs){const w=$("checks");w.innerHTML="";for(const c of cs){const el=document.createElement("div");el.className="check "+(c.ok?"good":"warn");el.textContent=`${c.ok?"✓":"!"} ${c.label}: ${c.msg}`;w.append(el)}$("statusText").textContent=cs.every(x=>x.ok)?"準備OK":"確認が必要です";$("statusText").className=cs.every(x=>x.ok)?"ok":"bad"}
$("runCheck").onclick=()=>preflight();

async function countdown(){if(!state.countdown)return;const o=$("countOverlay");o.style.display="grid";for(let i=state.countdown;i>=1;i--){o.textContent=i;await new Promise(r=>setTimeout(r,1000))}o.textContent="GO";await new Promise(r=>setTimeout(r,300));o.style.display="none"}
async function startRecording(){
  if(recording)return stopRecording();
  try{
    await preflight(true);await countdown();await setupAudio();if(audioCtx.state==="suspended")await audioCtx.resume();
    const [w,h]=$("resolution").value.split("x").map(Number);resize(w,h);
    const cap=comp.captureStream(Number($("fps").value)),tracks=[...cap.getVideoTracks()];
    if($("bgmRecord").checked&&state.bgmPath){tracks.push(...audioDest.stream.getAudioTracks());if($("audio").paused)$("audio").play()}
    if($("micOn").checked){try{micStream=await navigator.mediaDevices.getUserMedia({audio:true});tracks.push(...micStream.getAudioTracks())}catch{throw new Error("マイクを使用できませんでした。")}}
    const ms=new MediaStream(tracks);
    const mime=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(MediaRecorder.isTypeSupported)||"video/webm";
    chunks=[];recorder=new MediaRecorder(ms,{mimeType:mime,videoBitsPerSecond:18000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onerror=e=>showFatal("録画処理でエラーが発生しました。");
    recorder.onstop=async()=>{
      try{
        const blob=new Blob(chunks,{type:mime}),u=new Uint8Array(await blob.arrayBuffer()),stamp=new Date().toISOString().replace(/[:.]/g,"-");
        await window.halAPI.saveRecording(`HAL_${stamp}.webm`,u);
      }catch(e){showFatal("録画ファイルの保存に失敗しました。")}
    };
    recorder.start(500);recording=true;recordStart=performance.now();$("recordBtn").classList.add("recording");$("recordLabel").textContent="STOP";
  }catch(e){alert(e.message)}
}
function stopRecording(){if(!recording)return;try{recorder.stop()}catch{}recording=false;micStream?.getTracks().forEach(t=>t.stop());$("recordBtn").classList.remove("recording");$("recordLabel").textContent="REC";$("timer").textContent="00:00:00";$("meterFill").style.width="0"}
async function snapshot(){try{const b=await new Promise(r=>comp.toBlob(r,"image/png"));const u=new Uint8Array(await b.arrayBuffer());await window.halAPI.saveSnapshot(`HAL_${Date.now()}.png`,u)}catch{showFatal("PNG保存に失敗しました。")}}

function projectData(){return {...state,settings:{face:$("faceOn").checked,pose:$("poseOn").checked,hands:$("handsOn").checked,smooth:$("smooth").value,resolution:$("resolution").value,fps:$("fps").value,bgmVolume:$("bgmVolume").value,bgmLoop:$("bgmLoop").checked,bgmRecord:$("bgmRecord").checked,mic:$("micOn").checked}}}
async function applyProject(d){Object.assign(state,d);$("live2dPath").textContent=baseName(state.live2dPath);$("vrmPath").textContent=state.vrmPath?baseName(state.vrmPath):"簡易3D腕";if(d.settings){$("faceOn").checked=d.settings.face;$("poseOn").checked=d.settings.pose;$("handsOn").checked=d.settings.hands;$("smooth").value=d.settings.smooth;$("resolution").value=d.settings.resolution;$("fps").value=d.settings.fps;$("bgmVolume").value=d.settings.bgmVolume;$("bgmLoop").checked=d.settings.bgmLoop;$("bgmRecord").checked=d.settings.bgmRecord;$("micOn").checked=d.settings.mic}if(state.live2dPath)try{await loadLive2D(state.live2dPath)}catch(e){alert(e.message)}if(state.vrmPath)try{await loadVRM(state.vrmPath)}catch(e){alert(e.message)}if(state.bgmId){const item=bgmLibrary.find(x=>x.id===state.bgmId);if(item)selectBGM(item)}applyTransforms()}

$("openProject").onclick=async()=>{try{const d=await window.halAPI.loadProject();if(d)await applyProject(d)}catch(e){alert(e.message)}};
$("saveProject").onclick=async()=>{const d=projectData(),p=await window.halAPI.saveProject(d,false);if(p){state.projectPath=p;state.projectName=baseName(p).replace(".halproj.json","")}};
$("saveAsProject").onclick=async()=>{const d=projectData(),p=await window.halAPI.saveProject(d,true);if(p){state.projectPath=p;state.projectName=baseName(p).replace(".halproj.json","")}};

$("pickLive2D").onclick=async()=>{const p=await window.halAPI.pickModel();if(!p)return;state.live2dPath=p;$("live2dPath").textContent=baseName(p);try{await loadLive2D(p)}catch(e){alert(e.message)}};
$("pickVRM").onclick=async()=>{const p=await window.halAPI.pickVRM();if(!p)return;state.vrmPath=p;$("vrmPath").textContent=baseName(p);try{await loadVRM(p)}catch(e){alert(e.message)}};
$("cameraBtn").onclick=()=>startCamera().catch(e=>alert("カメラを開始できませんでした。\n"+e.message));
$("calibrateBtn").onclick=()=>{state.transforms.arms={x:0,y:0,scale:1,rot:0};applyTransforms()};
$("smooth").oninput=e=>$("smoothOut").value=Number(e.target.value).toFixed(2);
$("guideOn").onchange=e=>state.guide=e.target.checked;$("mirrorOn").onchange=e=>state.mirror=e.target.checked;$("watermarkOn").onchange=e=>{state.watermark=e.target.checked;syncSlotImages()};$("badgeOn").onchange=e=>{state.badge=e.target.checked;syncSlotImages()};

document.querySelectorAll("[data-ratio]").forEach(b=>b.onclick=()=>{state.ratio=b.dataset.ratio;$("stageWrap").style.aspectRatio=b.dataset.ratio.replace(":","/");document.querySelectorAll("[data-ratio]").forEach(x=>x.classList.toggle("active",x===b))});
document.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{state.target=b.dataset.target;document.querySelectorAll("[data-target]").forEach(x=>x.classList.toggle("active",x===b))});
document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{const t=state.transforms[state.target],k=b.dataset.move;if(k==="up")t.y-=12;if(k==="down")t.y+=12;if(k==="left")t.x-=12;if(k==="right")t.x+=12;if(k==="center"){t.x=0;t.y=0}applyTransforms()});
$("smaller").onclick=()=>{state.transforms[state.target].scale=Math.max(.2,state.transforms[state.target].scale-.05);applyTransforms()};$("larger").onclick=()=>{state.transforms[state.target].scale=Math.min(3,state.transforms[state.target].scale+.05);applyTransforms()};$("rotL").onclick=()=>{state.transforms[state.target].rot-=2;applyTransforms()};$("rotR").onclick=()=>{state.transforms[state.target].rot+=2;applyTransforms()};$("resetPos").onclick=()=>{state.transforms[state.target]={x:0,y:0,scale:1,rot:0};applyTransforms()};

document.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>{state.bg=b.dataset.bg;document.querySelectorAll("[data-bg]").forEach(x=>x.classList.toggle("active",x===b))});
$("resolution").onchange=()=>{const [w,h]=$("resolution").value.split("x").map(Number);resize(w,h)};
$("recordBtn").onclick=startRecording;$("snapshotBtn").onclick=snapshot;
$("countdownBtn").onclick=()=>{state.countdown=state.countdown===3?5:state.countdown===5?0:3;$("countdownLabel").textContent=state.countdown?state.countdown+"秒":"なし"};
$("chooseOutput").onclick=async()=>{const p=await window.halAPI.chooseOutputDir();if(p)$("saveDir").textContent=p};
$("openOutput").onclick=()=>window.halAPI.openOutputDir();

navigator.mediaDevices?.addEventListener?.("devicechange",listCameras);

(async()=>{
  try{
    await loadSlots();
    await loadBGMLibrary();
    await listCameras();
    const settings=await window.halAPI.getSettings();
    $("saveDir").textContent=settings.outputDir||"";
    await firstRun();
    initVision();
    loop(performance.now());
    preflight();
  }catch(e){showFatal("起動処理に失敗しました。ログを確認してください。");log(e.stack||e.message)}
})();
