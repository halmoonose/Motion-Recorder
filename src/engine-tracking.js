
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { FilesetResolver, PoseLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";

(()=>{
  let o=null,v=null,c=null,r=null,s=null,cam=null,g=null;
  let pose=null,hands=null,run=false,last=-1,vrm=null,prepared=false;

  function world(p){
    const mirror=o?.getMirror?.() ?? true;
    const x=((mirror?1-p.x:p.x)-.5)*2;
    const y=(.5-p.y)*2*(c.height/c.width);
    return new THREE.Vector3(x,y,-(p.z||0));
  }
  function clear(){
    if(!g)return;
    while(g.children.length){
      const x=g.children.pop();
      x.geometry?.dispose();
      x.material?.dispose();
    }
  }
  function cap(a,b,rad=.05){
    const m=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b);
    const x=new THREE.Mesh(
      new THREE.CapsuleGeometry(rad,Math.max(.01,len-rad*2),8,12),
      new THREE.MeshStandardMaterial({color:0xffc6dd,roughness:.72})
    );
    x.position.copy(m);
    x.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
    return x;
  }
  function tf(x){
    const t=o?.getTransform?.() || {x:0,y:0,scale:1,rot:0};
    return x.multiplyScalar(t.scale)
      .applyAxisAngle(new THREE.Vector3(0,0,1),t.rot*Math.PI/180)
      .add(new THREE.Vector3(t.x/500,-t.y/500,0));
  }

  async function prepare(opts){
    if(prepared)return;
    o={...(o||{}),...(opts||{})};
    c=opts.canvas;
    r=new THREE.WebGLRenderer({canvas:c,alpha:true,antialias:true,preserveDrawingBuffer:true});
    r.setPixelRatio(1);
    r.setSize(c.width,c.height,false);
    r.outputColorSpace=THREE.SRGBColorSpace;
    s=new THREE.Scene();
    cam=new THREE.OrthographicCamera(-1,1,c.height/c.width,-c.height/c.width,.01,100);
    cam.position.z=5;
    s.add(new THREE.HemisphereLight(0xffffff,0x555566,3));
    const dl=new THREE.DirectionalLight(0xffffff,2.5);
    dl.position.set(2,4,5); s.add(dl);
    g=new THREE.Group(); s.add(g);
    prepared=true;
    renderOnce();
  }

  async function init(opts){
    o={...(o||{}),...(opts||{})};
    v=opts.video;
    if(!prepared) await prepare(opts);

    if(!pose){
      try{
        const vision=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
        const base="https://storage.googleapis.com/mediapipe-models";
        pose=await PoseLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:`${base}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,delegate:"GPU"},
          runningMode:"VIDEO",numPoses:1
        });
        hands=await HandLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:`${base}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker_full.task`,delegate:"GPU"},
          runningMode:"VIDEO",numHands:2
        }).catch(async()=>HandLandmarker.createFromOptions(vision,{
          baseOptions:{modelAssetPath:`${base}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,delegate:"GPU"},
          runningMode:"VIDEO",numHands:2
        }));
      }catch(e){
        console.warn("MediaPipe init failed",e);
      }
    }
  }

  function renderOnce(){
    if(r&&s&&cam)r.render(s,cam);
  }

  function loop(ts){
    if(!run)return;
    if(v?.videoWidth && v.currentTime!==last && pose){
      last=v.currentTime;
      try{
        const p=pose.detectForVideo(v,ts);
        const h=hands?.detectForVideo(v,ts);
        if(!vrm){
          clear();
          if(p.landmarks?.[0]){
            const q=p.landmarks[0];
            for(const [a,b] of [[11,13],[13,15],[12,14],[14,16]])
              g.add(cap(tf(world(q[a])),tf(world(q[b]))));
            if(h?.landmarks)for(const hh of h.landmarks){
              const ww=tf(world(hh[0]));
              for(const i of [4,8,12,16,20])g.add(cap(ww,tf(world(hh[i])),.015));
            }
          }
        }
      }catch{}
    }
    renderOnce();
    requestAnimationFrame(loop);
  }

  async function loadVRM(path){
    if(!prepared) throw new Error("3D描画エンジンの準備ができていません");
    const l=new GLTFLoader();
    l.register(p=>new VRMLoaderPlugin(p));
    const url="file:///"+path.replace(/\\/g,"/");
    const gltf=await l.loadAsync(url);
    if(vrm)s.remove(vrm.scene);
    vrm=gltf.userData.vrm;
    if(!vrm) throw new Error("VRMとして読み込めませんでした");
    s.add(vrm.scene);
    vrm.scene.position.set(0,0,0);
    vrm.scene.scale.setScalar(1);
    renderOnce();
  }

  function applyTransform(){
    if(vrm){
      const t=o?.getTransform?.() || {x:0,y:0,scale:1,rot:0};
      vrm.scene.position.set(t.x/500,-t.y/500,0);
      vrm.scene.scale.setScalar(t.scale);
      vrm.scene.rotation.z=t.rot*Math.PI/180;
      renderOnce();
    }
  }

  window.HALTracking={
    prepare,init,
    start(){if(!run){run=true;requestAnimationFrame(loop)}},
    loadVRM,
    calibrate(){},
    applyTransform
  };
})();
