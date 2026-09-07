# RC4 FIX

修正:
- Live2D canvas が opacity:0 のままだった問題を修正
- compositeに描画していないのにcompositeだけ表示していた構造を修正
- Live2Dを直接プレビューへ表示
- Live2D読み込み時に自動フィット + 中央配置
- 3D腕をカメラ開始前に選ぶと失敗する問題を修正
- Three.js scene をVRM選択前にprepare
- VRM読込成功時にプレビュー表示

確認:
1. Cubism Core設定
2. Live2D変更 → model3.json
3. 中央にモデルが表示される
4. 3D腕変更 → VRM/GLB
5. カメラ未開始でも3D読込自体は成功する
