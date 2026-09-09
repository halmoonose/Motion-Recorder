
const esbuild = require("esbuild");
const path = require("path");
const { nodeModulesPolyfillPlugin } = require("esbuild-plugins-node-modules-polyfill");

(async () => {
  const r = path.resolve(__dirname, "..");

  // 3D / MediaPipe bundle
  await esbuild.build({
    entryPoints: [path.join(r, "src", "engine-tracking.js")],
    outfile: path.join(r, "src", "engine-tracking.bundle.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["chrome120"],
    minify: false
  });

  // Live2D renderer depends on Node's `path` module internally even though
  // it is intended for browser use. Its own web build uses Node polyfills.
  await esbuild.build({
    entryPoints: [path.join(r, "src", "engine-live2d.js")],
    outfile: path.join(r, "src", "engine-live2d.bundle.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["chrome120"],
    minify: false,
    plugins: [
      nodeModulesPolyfillPlugin({
        globals: {
          process: true,
          Buffer: true
        }
      })
    ]
  });

  console.log("engine bundles created");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
