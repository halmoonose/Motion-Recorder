
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { FilesetResolver, PoseLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
(()=>{let o,v,c,r,s,cam,g,pose=null,hands=null,run=false,last=-1,vrm=null;
function w(p){const x=((o.getMirror()?1-p.x:p.x)-.5)*2,y=(.5-p.y)*2*(c.height/c.width);return new THREE.Vector3(x,y,-(p.z||0))}
function clear(){while(g.children.length){const x=g.children.pop();x.geometry?.dispose();x.material?.dispose()}}
function cap(a,b,rad=.05){const m=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b),x=new THREE.Mesh(new THREE.CapsuleGeometry(rad,Math.max(.01,len-rad*2),8,12),new THREE.MeshStandardMaterial({color:0xffc6dd}));x.position.copy(m);x.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return x}
function tf(x){const t=o.getTransform();return x.multiplyScalar(t.scale).applyAxisAngle(new THREE.Vector3(0,0,1),t.rot*Math.PI/180).add(new THREE.Vector3(t.x/500,-t.y/500,0))}
async function init(opts){o=opts;v=o.video;c=o.canvas;r=new THREE.WebGLRenderer({canvas:c,alpha:true,antialias:true});r.setSize(c.width,c.height,false);s=new THREE.Scene();cam=new THREE.OrthographicCamera(-1,1,c.height/c.width,-c.height/c.width,.01,100);cam.position.z=5;s.add(new THREE.HemisphereLight(0xffffff,0x555566,3));g=new THREE.Group();s.add(g);
try{const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");const base="https://storage.googleapis.com/mediapipe-models";pose=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:`${base}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,delegate:"GPU"},runningMode:"VIDEO",numPoses:1});hands=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:`${base}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,delegate:"GPU"},runningMode:"VIDEO",numHands:2})}catch(e){console.warn(e)}}
function loop(ts){if(!run)return;if(v.videoWidth&&v.currentTime!==last&&pose){last=v.currentTime;try{const p=pose.detectForVideo(v,ts);const h=hands.detectForVideo(v,ts);clear();if(p.landmarks?.[0]){const q=p.landmarks[0];for(const [a,b] of [[11,13],[13,15],[12,14],[14,16]])g.add(cap(tf(w(q[a])),tf(w(q[b]))));if(h?.landmarks)for(const hh of h.landmarks){const ww=tf(w(hh[0]));for(const i of [4,8,12,16,20])g.add(cap(ww,tf(w(hh[i])),.015))}}}catch{}}r.render(s,cam);requestAnimationFrame(loop)}
async function loadVRM(path){const l=new GLTFLoader();l.register(p=>new VRMLoaderPlugin(p));const gltf=await l.loadAsync("file:///"+path.replace(/\\/g,"/"));if(vrm)s.remove(vrm.scene);vrm=gltf.userData.vrm;s.add(vrm.scene)}
window.HALTracking={init,start(){if(!run){run=true;requestAnimationFrame(loop)}},loadVRM,calibrate(){},applyTransform(){}};
})();
