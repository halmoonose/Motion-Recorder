# RC5 FIX

## Live2D
RC4までは .model3.json を file:// で直接読み込んでいました。
model3.json 内の moc3 / texture / physics 等の相対参照がパッケージ版Electronで失敗しうるため、
RC5では `halmodel://` 専用ローカルプロトコルを実装しました。

- model3.jsonを選ぶ
- そのモデルフォルダをアプリが登録
- halmodel:// 経由でJSON / moc3 / PNG等を配信
- 相対ファイルも同じフォルダから解決

## Camera
- setPermissionRequestHandler
- setPermissionCheckHandler
の両方を追加。
- 選択カメラ exact
- 通常video constraints
- video:true
の3段階でフォールバック。
失敗時は NotAllowedError / NotFoundError / NotReadableError 等の具体的理由を表示します。
