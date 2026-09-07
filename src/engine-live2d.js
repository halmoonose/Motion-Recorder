
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

    const url="file:///"+o.path.replace(/\\/g,"/");
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

  window.HALLive2D={load,applyTransform};
})();
