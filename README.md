# sheet-to-slack-bot

Google スプレッドシートに蓄積された週次の活動ログを、Gemini API で要約し Slack に自動投稿する Google Apps Script（GAS）プロジェクトです。

## 構成

```
スプレッドシート（先週 月〜金のデータを抽出）
    ↓
Gemini API（要約生成）
    ↓
Slack Incoming Webhook（チャンネルに投稿）
```

## ディレクトリ構成

```
sheet-to-slack-bot/
├── README.md
└── src/
    └── main.gs    # GAS メインスクリプト
```

## セットアップ

### 1. Gemini API キーの取得

[Google AI Studio](https://aistudio.google.com/apikey) で API キーを発行してください。

### 2. Slack Incoming Webhook の作成

1. [Slack API](https://api.slack.com/apps) で App を作成
2. Incoming Webhooks を有効化
3. 投稿先チャンネルを選択して Webhook URL を取得

### 3. スクリプトプロパティの設定

Apps Script エディタの **⚙ プロジェクトの設定 → スクリプト プロパティ** に以下を登録してください。

| プロパティ名        | 値                         |
| ------------------- | -------------------------- |
| `GEMINI_API_KEY`    | 取得した Gemini API キー   |
| `SLACK_WEBHOOK_URL` | 取得した Slack Webhook URL |

> ⚠️ API キーや Webhook URL をコードに直接記載しないでください。

### 4. GAS へのデプロイ

1. 対象のスプレッドシートを開く
2. 「拡張機能」→「Apps Script」でエディタを開く
3. `src/main.gs` の内容をエディタに貼り付ける
4. `CONFIG.SHEET_NAME` を実際のシート名に変更する

### 5. トリガーの設定

Apps Script エディタの **⏰ トリガー → トリガーを追加** で以下を設定してください。

| 項目             | 設定値                    |
| ---------------- | ------------------------- |
| 実行する関数     | `summarizeAndPostToSlack` |
| イベントのソース | 時間主導型                |
| トリガーのタイプ | 週ベースのタイマー        |
| 曜日             | 毎週月曜日                |
| 時刻             | 午前11時〜12時            |

## 設定値

`CONFIG` オブジェクトで以下の値を管理しています。

| 項目           | 説明                   | デフォルト値       |
| -------------- | ---------------------- | ------------------ |
| `SHEET_NAME`   | 対象のシート名         | `Form_Responses`   |
| `GEMINI_MODEL` | 使用する Gemini モデル | `gemini-2.5-flash` |

## 注意事項

- **Gemini API のモデル名は将来変更される可能性があります。** エラーが発生した場合はまずモデル名を確認してください。
- **Gemini API の無料枠** で運用可能です（週1回の実行であれば十分）。
- トリガーの **エラー通知設定** を「毎日通知を受け取る」にしておくと、失敗時にメールで知らせてくれます。
- スプレッドシートの構成（列の追加・削除、シート名変更など）を変更した場合は、コード側の設定も更新してください。
