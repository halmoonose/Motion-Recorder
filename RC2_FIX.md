# RC2 FIX

RC1で画面は開くが、変更・カメラ・差し込み画像・背景などが無反応になる問題を修正。

原因:
Electronでpackage化したRendererから npm package を bare import していたため、
renderer.js が起動時に停止していました。

修正:
- esbuildでrenderer.jsを1ファイルにbundle
- index.htmlはrenderer.bundle.jsを読み込む
- Live2D loaderもbundle可能な構成へ変更
- MediaPipe初期化失敗時もUI全体は停止しない

差し込み画像:
- 左下ブランド画像: アプリ左下のロゴ画像
- プレビュー透かし: 録画/プレビューに載せるロゴ
- 録画タグ: 左下などに載せるラベル
それぞれ自作PNGへ差し替え可能です。
