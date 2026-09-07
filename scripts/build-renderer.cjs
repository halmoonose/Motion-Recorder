
const esbuild = require("esbuild");
const path = require("path");

(async () => {
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "..", "src", "renderer.js")],
      outfile: path.join(__dirname, "..", "src", "renderer.bundle.js"),
      bundle: true,
      platform: "browser",
      format: "iife",
      target: ["chrome120"],
      sourcemap: false,
      minify: false,
      define: {"process.env.NODE_ENV": '"production"'}
    });
    console.log("renderer.bundle.js created");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
