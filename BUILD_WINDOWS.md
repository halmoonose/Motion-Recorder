# Windows EXEの作り方

## 方法A: 開発PCでビルド
1. Node.js LTSを開発PCに入れる
2. このフォルダで `npm install`
3. `npm run build:win`
4. `dist` フォルダに出たEXEをテスト

利用者側にはNode.jsは不要です。

## 方法B: GitHub Actionsでビルド
1. このフォルダ一式をGitHubリポジトリへアップロード
2. GitHubのActionsを開く
3. `Build Windows Release`
4. `Run workflow`
5. 完了後 `HAL-Motion-Recorder-Windows` artifactをダウンロード

## 署名
コード署名証明書を購入した後はelectron-builderのWindows署名設定を追加できます。
署名なしでもビルド・テストは可能ですがSmartScreen等の警告が出る場合があります。
