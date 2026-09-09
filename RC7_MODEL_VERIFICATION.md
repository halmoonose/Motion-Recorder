# RC7 MODEL VERIFICATION

Uploaded model: `tsukinosehal_live2d.model3.json`

## Verified from the actual uploaded model
- model3 JSON parsed: YES
- MOC: `TsukinoseHal_Live2d.moc3`
- MOC header: `4d4f433305000000`
- MOC3 version byte: **5**
- textures: 2
- physics reference: TsukinoseHal_Live2d.physics3.json
- display-info reference: TsukinoseHal_Live2d.cdi3.json
- missing referenced files: **0**
- all referenced files exist

## Root cause found
The previous app used `pixi-live2d-display/cubism4`.
That library documents support for Cubism 3/4, not Cubism 5.
Your uploaded model's MOC3 version is **5**, so the renderer choice was incompatible.

RC7 removes `pixi-live2d-display` and uses `live2d-renderer`,
which explicitly supports Cubism 5 models.

## Submission checks
- actual uploaded model references checked
- old Cubism4-only dependency removed
- Cubism5-capable renderer dependency added
- model picker now inspects referenced files before attempting render
- MOC version is written to application log
