# RC6 verification

RC5で変更ボタンまで動かなくなった原因は `src/ui.js` のJavaScript構文エラーでした。
カメラエラー文の改行を通常の文字列内へ直接入れてしまっており、ui.js全体がparse時点で停止していました。

RC6では以下を実施しています。
- ui.jsの構文エラー修正
- Node.js `--check` で main/preload/ui/engine すべて構文確認
- Chromiumのモック環境でUIを実際にロードし、主要ボタンのイベントを自動クリック検証
- Live2D専用 `halmodel://` のIDをURL hostnameで安全な小文字hexへ変更

検証対象: Live2D変更、3D腕変更、背景切替、差し込み画像、BGM追加、保存先変更、保存、カメラボタンのイベント接続。

追加確認:
- HTML上の操作コントロール43個を静的照合し、openLogs/トラッキングON-OFF/カウントダウン/REC/PNG/BGM録画/マイク/Seek/解像度/FPS/チェックの未接続を発見して実装。
- 出力用composite canvasの合成ループを追加。
- MediaPipe Face結果をLive2Dの目・口・頭角度へ渡す処理を追加。
