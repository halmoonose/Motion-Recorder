
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
window.PIXI=PIXI;

(()=>{
  let app=null,m=null,o=null;
  let autoBaseScale=1;

  async function load(opts){
    o=opts;
    if(!window.Live2DCubismCore)throw new Error("Cubism Core未設定");

    if(!app){
      app=new PIXI.Application({
        view:o.canvas,
        width:o.canvas.width,
        height:o.canvas.height,
        backgroundAlpha:0,
        antialias:true,
        autoStart:true
      });
    }

    if(m){
      app.stage.removeChild(m);
      m.destroy({children:true});
    }

    const url=o.url || ("file:///"+o.path.replace(/\\/g,"/"));
    console.log("Live2D loading",url);
    m=await Live2DModel.from(url,{autoInteract:false});

    if(!m)throw new Error("Live2Dモデルを読み込めませんでした");

    m.anchor.set(.5,.5);
    app.stage.addChild(m);

    // Fit model inside canvas automatically.
    const cw=app.renderer.width, ch=app.renderer.height;
    const mw=Math.max(1,m.width), mh=Math.max(1,m.height);
    autoBaseScale=Math.min((cw*0.88)/mw,(ch*0.88)/mh);
    if(!Number.isFinite(autoBaseScale)||autoBaseScale<=0)autoBaseScale=1;

    applyTransform();
  }

  function applyTransform(){
    if(!m||!o)return;
    const t=o.getTransform();
    const cw=app.renderer.width,ch=app.renderer.height;

    m.x=cw/2+t.x;
    m.y=ch/2+t.y;
    m.scale.set(autoBaseScale*t.scale);
    m.rotation=t.rot*Math.PI/180;
  }

  function param(id,v){try{m?.internalModel?.coreModel?.setParameterValueById(id,v)}catch{}}
function updateFace(data){if(!m||!data)return;const cats=data.faceBlendshapes?.[0]?.categories||[];const score=n=>cats.find(x=>x.categoryName===n)?.score||0;param("ParamEyeLOpen",1-score("eyeBlinkLeft"));param("ParamEyeROpen",1-score("eyeBlinkRight"));param("ParamMouthOpenY",Math.min(1,score("jawOpen")*1.5));param("ParamMouthForm",Math.max(-1,Math.min(1,(score("mouthSmileLeft")+score("mouthSmileRight"))-.2)));const a=data.facialTransformationMatrixes?.[0]?.data;if(a?.length>=16){const sy=Math.sqrt(a[0]*a[0]+a[1]*a[1]);const x=Math.atan2(a[6],a[10]),y=Math.atan2(-a[2],sy),z=Math.atan2(a[1],a[0]),d=180/Math.PI;param("ParamAngleX",-y*d*1.3);param("ParamAngleY",x*d*1.3);param("ParamAngleZ",-z*d)}}
window.HALLive2D={load,applyTransform,updateFace};
})();
