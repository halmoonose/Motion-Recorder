# RC7.1 Build Fix

GitHub Actions error:
`Could not resolve "path"` from `live2d-renderer`.

Cause:
`live2d-renderer` is browser-oriented, but its client build uses Node built-in
polyfills. HAL Motion Recorder was bundling it with plain esbuild and did not
provide those polyfills.

Fix:
- added `esbuild-plugins-node-modules-polyfill`
- applied it to the Live2D browser bundle
- enabled `process` and `Buffer` globals
- kept tracking bundle separate

This is specifically a build-system fix. The Cubism 5 renderer introduced in
RC7 is unchanged.
