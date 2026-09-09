
import { Live2DCubismModel } from "live2d-renderer";

(()=>{
  let model=null;
  let opts=null;
  let baseScale=1;

  function normalizedTransform(){
    const t=opts?.getTransform?.() || {x:0,y:0,scale:1,rot:0};
    const canvas=opts.canvas;
    return {
      x: t.x / Math.max(1, canvas.width),
      y: t.y / Math.max(1, canvas.height),
      scale: Math.max(0.05, baseScale * t.scale),
      rot: t.rot
    };
  }

  async function load(o){
    opts=o;
    if(!window.Live2DCubismCore){
      throw new Error("Cubism Coreが読み込まれていません");
    }

    if(model){
      try{ model.destroy?.(); }catch{}
      model=null;
    }

    const source=o.url || o.path;
    if(!source) throw new Error("Live2Dモデルのパスがありません");

    const canvas=o.canvas;
    if(!canvas.width) canvas.width=1080;
    if(!canvas.height) canvas.height=1920;

    model=new Live2DCubismModel(canvas,{
      autoAnimate:true,
      autoInteraction:false,
      tapInteraction:false,
      randomMotion:false,
      keepAspect:false,
      cubismCorePath: window.__HAL_CUBISM_CORE_URL || undefined,
      checkMocConsistency:true,
      maxTextureSize:8192,
      scale:1,
      x:0,
      y:0,
      enablePhysics:true,
      enableEyeblink:true,
      enableBreath:true,
      enableLipsync:false,
      enableMotion:true,
      enableExpression:true,
      enableMovement:true,
      enablePose:true
    });

    console.log("[HAL Live2D] loading Cubism5 model:", source);
    await model.load(source);

    // Start conservatively. The app-side +/- controls multiply from this base.
    baseScale=1;
    applyTransform();

    console.log("[HAL Live2D] loaded", {
      parameters:model.parameters?.length,
      parts:model.parts?.length,
      drawables:model.drawables?.length
    });
  }

  function applyTransform(){
    if(!model || !opts) return;
    const t=normalizedTransform();

    // live2d-renderer exposes pan/zoom style properties on the model.
    // Guard each assignment so rendering stays alive across minor package API changes.
    try{ if("scale" in model) model.scale=t.scale; }catch{}
    try{ if("x" in model) model.x=t.x; }catch{}
    try{ if("y" in model) model.y=-t.y; }catch{}
    try{ if("rotation" in model) model.rotation=t.rot*Math.PI/180; }catch{}
  }

  function setParam(id,v){
    if(!model)return;
    try{ model.setParameter(id,v); }catch{}
  }

  function updateFace(data){
    if(!model || !data)return;
    const cats=data.faceBlendshapes?.[0]?.categories||[];
    const score=n=>cats.find(x=>x.categoryName===n)?.score||0;

    setParam("ParamEyeLOpen",1-score("eyeBlinkLeft"));
    setParam("ParamEyeROpen",1-score("eyeBlinkRight"));
    setParam("ParamMouthOpenY",Math.min(1,score("jawOpen")*1.5));
    setParam("ParamMouthForm",Math.max(-1,Math.min(1,(score("mouthSmileLeft")+score("mouthSmileRight"))-.2)));

    const a=data.facialTransformationMatrixes?.[0]?.data;
    if(a?.length>=16){
      const sy=Math.sqrt(a[0]*a[0]+a[1]*a[1]);
      const x=Math.atan2(a[6],a[10]);
      const y=Math.atan2(-a[2],sy);
      const z=Math.atan2(a[1],a[0]);
      const d=180/Math.PI;
      setParam("ParamAngleX",-y*d*1.3);
      setParam("ParamAngleY",x*d*1.3);
      setParam("ParamAngleZ",-z*d);
    }
  }

  function info(){
    return {
      loaded:!!model,
      parameters:model?.parameters?.length||0,
      parts:model?.parts?.length||0,
      drawables:model?.drawables?.length||0
    };
  }

  window.HALLive2D={load,applyTransform,updateFace,info};
})();
