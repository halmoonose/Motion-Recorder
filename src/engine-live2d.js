
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
window.PIXI=PIXI;
(()=>{let app=null,m=null,o=null;
async function load(opts){o=opts;if(!window.Live2DCubismCore)throw new Error("Cubism Core未設定");if(!app)app=new PIXI.Application({view:o.canvas,width:o.canvas.width,height:o.canvas.height,backgroundAlpha:0,antialias:true});if(m){app.stage.removeChild(m);m.destroy({children:true})}m=await Live2DModel.from("file:///"+o.path.replace(/\\/g,"/"),{autoInteract:false});m.anchor.set(.5,.5);app.stage.addChild(m);applyTransform()}
function applyTransform(){if(!m||!o)return;const t=o.getTransform();m.x=app.renderer.width/2+t.x;m.y=app.renderer.height/2+t.y;m.scale.set(t.scale);m.rotation=t.rot*Math.PI/180}
window.HALLive2D={load,applyTransform};
})();
