# HAL Motion Recorder RC1

配布を前提にしたRelease Candidate版です。

## 利用者向けの最終形
ビルド後は利用者にNode.jsやBATを触らせません。

- `HAL-Motion-Recorder-...-Setup.exe` : インストーラ
- `HAL-Motion-Recorder-...-portable.exe` : Portable版

のどちらかをダブルクリックして使う想定です。

## RC1で実装したもの

### 初回セットアップ
- 初回起動時にCubism Coreの有無を自動確認
- `live2dcubismcore.min.js` をアプリ画面から選択
- 選択したCoreをユーザーデータにコピー
- Core未設定でも簡易3D腕だけ試せる
- Core設定画面を再表示可能

### トラッキング
- Webカメラ一覧
- カメラ開始/停止
- MediaPipe Face / Pose / Hand
- 同じWebカメラから顔・肩・肘・手首・指を取得
- 簡易3D腕
- 腕専用VRM読込
- Live2D基本表情パラメータ
- スムージング
- キャリブレーション
- 左右反転
- ガイド表示

### 位置調整
- Live2D / 3D腕の対象切替
- ↑ ↓ ← →
- ◎ 中央
- ± サイズ
- ↶ ↷ 回転
- リセット

### BGM
- 複数BGMをローカルライブラリへ追加
- 曲名検索
- 選択/削除
- 再生/停止
- 音量
- ループ
- 開始位置
- 録画へのBGM混音

### 差し込み画像
- 初期デモ画像
- 差し替え
- 同じスロットは上書き
- 別名保存
- 初期状態へ戻す
- 左下ブランド画像
- プレビュー透かし
- 録画タグ

### 録画
- 3秒 / 5秒 / なしカウントダウン
- REC / STOP
- マイク録音
- BGM録音
- PNG撮影
- 30 / 60fps
- 1080x1920 / 720x1280 / 1080x1080 / 1920x1080
- 透過 / 緑 / 黒 / 白
- 保存先変更
- 保存フォルダを開く
- 録画前チェック

### 安定性
- メインプロセスログ
- Renderer例外表示
- ログフォルダを開く
- 保存先書き込みチェック
- カメラ/モデル/Core/保存先のPreflight
- エラー時にアプリ全体を落としにくい構成

### プロジェクト
- 開く
- 保存
- 名前を付けて保存
- 最近のプロジェクト履歴

## 開発者向けビルド

Node.js LTSを開発PCに入れて:

    npm install
    npm run build:win

`dist` にWindows用インストーラとPortable EXEが生成されます。

### 自分のPCにNode.jsを入れたくない場合

GitHub Actionsを同梱しています。

`.github/workflows/build-windows.yml`

GitHubへこのフォルダをアップロードし、Actionsから `Build Windows Release` を実行するとWindows環境でビルドできます。

## Smart App Controlについて

未署名EXEは正常なアプリでもWindows Smart App Control / SmartScreenに止められる可能性があります。

コード側でこの警告を完全に消すことはできません。
一般配布で警告を最小化する最終工程はWindowsコード署名です。

本RC1は「BATを配布しない」「利用者にNode.jsを要求しない」構成にすることで、
前回のBAT起因のSmart App Control問題を避ける設計です。

## Live2D Coreについて

Live2D Cubism Coreそのものは同梱していません。
初回起動時にユーザーが公式SDKから取得した `live2dcubismcore.min.js` を選択します。

## 注意

この環境ではWindows実機・実Webカメラ・ユーザー所有Live2D/VRMを接続した実機検証まではできません。
そのため「全Windows環境で一切エラーが出ない」ことを保証するものではありません。
配布前にWindows実機でRCテストしてください。
