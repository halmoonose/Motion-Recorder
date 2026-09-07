
const esbuild=require("esbuild");
const path=require("path");
(async()=>{
  const r=path.resolve(__dirname,"..");
  for(const [src,out] of [
    ["engine-tracking.js","engine-tracking.bundle.js"],
    ["engine-live2d.js","engine-live2d.bundle.js"]
  ]){
    await esbuild.build({
      entryPoints:[path.join(r,"src",src)],
      outfile:path.join(r,"src",out),
      bundle:true,
      platform:"browser",
      format:"iife",
      target:["chrome120"],
      minify:false
    });
  }
  console.log("engine bundles created");
})().catch(e=>{console.error(e);process.exit(1)});
