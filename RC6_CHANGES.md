# HAL Motion Recorder RC6

RC5で変更ボタンまで無反応になった原因は `src/ui.js` のJavaScript構文エラーでした。
カメラエラー文の改行を文字列内へ直接入れており、UIスクリプト全体がparse時点で停止していました。

RC6では以下を修正・確認しています。

- UI構文エラーを修正
- Live2Dモデル用 `halmodel://` IDをURL安全な小文字hexへ変更
- 43個のUIコントロールを静的照合し、未接続だった操作を実装
  - 開く/保存/名前を付けて保存
  - Live2D/3D腕選択
  - カメラ
  - 顔/上半身/手指ON-OFF
  - 差し込み画像
  - 背景
  - BGM再生/音量/ループ/シーク
  - カウントダウン
  - REC/STOP
  - PNG撮影
  - BGM録画/マイク
  - 解像度/FPS
  - 保存先
  - 状態チェック/ログ
- composite canvasへLive2D + 3D腕 + 透かし + 録画タグを合成
- MediaPipe Face結果をLive2Dの目・口・頭角度へ反映

## 実施した検証

- `node --check`:
  - src/main.cjs
  - src/preload.cjs
  - src/ui.js
  - src/engine-tracking.js
  - src/engine-live2d.js
  - scripts/build-engines.cjs
  すべてPASS
- index.html上の操作コントロール43個とui.jsのハンドラ参照を照合: 未接続0

Windows実機のWebカメラ、ユーザー所有Live2D/VRMをこの環境へ接続しての実機確認はできないため、その部分はRCビルド後に実機確認が必要です。
