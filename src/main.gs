// ===== 設定 =====
const CONFIG = {
  GEMINI_API_KEY:
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY"),
  SLACK_WEBHOOK_URL:
    PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK_URL"),
  SHEET_NAME: "フォームの回答",
  GEMINI_MODEL: "gemini-2.5-flash",
};

// ===== メイン処理 =====
function summarizeAndPostToSlack() {
  try {
    const data = getSheetData();
    if (!data) {
      console.log("データがありません");
      return;
    }

    const summary = summarizeWithGemini(data);
    postToSlack(summary);
    console.log("完了しました");
  } catch (error) {
    console.error("エラー:", error);
    postToSlack(`⚠️ エラーが発生しました: ${error.message}`);
  }
}

// ===== スプレッドシートからデータ取得 =====
function getSheetData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    CONFIG.SHEET_NAME,
  );
  if (!sheet) {
    throw new Error(`シート「${CONFIG.SHEET_NAME}」が見つかりません`);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const headers = data[0];
  const rows = data.slice(1);

  // 先週の月曜〜金曜（JST）を算出
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=日, 1=月, ...
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - dayOfWeek - 6); // 先週月曜
  lastMonday.setHours(0, 0, 0, 0);

  const lastFriday = new Date(lastMonday);
  lastFriday.setDate(lastMonday.getDate() + 4);
  lastFriday.setHours(23, 59, 59, 999);

  console.log(
    "対象期間:",
    lastMonday.toLocaleDateString(),
    "〜",
    lastFriday.toLocaleDateString(),
  );

  // 日付列（ヘッダーに「タイムスタンプ」を含む列）でフィルタ
  const dateColIndex = headers.findIndex((h) =>
    String(h).includes("タイムスタンプ"),
  );

  let filteredRows = rows;
  if (dateColIndex >= 0) {
    filteredRows = rows.filter((row) => {
      const cellDate = new Date(row[dateColIndex]);
      return cellDate >= lastMonday && cellDate <= lastFriday;
    });
    console.log(`日付フィルタ: ${rows.length}行 → ${filteredRows.length}行`);
  } else {
    console.log("日付列が見つからないため、全データを対象にします");
  }

  if (filteredRows.length === 0) return null;

  const formatted = filteredRows
    .map((row) => {
      return headers.map((header, i) => `${header}: ${row[i]}`).join(", ");
    })
    .join("\n");

  return formatted;
}

// ===== Gemini APIで要約 =====
function summarizeWithGemini(data) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  const prompt = `以下はグループ1〜7に分かれて話したログです。
このログをハイライト形式で簡潔に500文字程度にまとめてください。
以下の要件に基づいてまとめてください。

＜要件＞
1. 匿名性: どのグループ、どのメンバーのログかは特定できないようにする。
2. テーマ別構造: ログの内容を分析し、主要なテーマを2つ、または3つ選び出してまとめの見出しとする。
3. 詳細と具体性: 各テーマの下に、具体的な活動内容や成果を箇条書きで簡潔に記述する。
4. ハイライト: 重要なキーワードや成果は太字で強調すること。
5. 結論: 全体のまとめとして、この一週間の活動がもたらしている影響について簡潔に締めくくること。
6. 情報のきっかけ: スプレッドシートを見るきっかけとするため、全ての情報を網羅する必要はないが、興味を持ってもらえるような具体的な成功事例や課題解決のヒントを簡潔に含めること。
7. 最後にスプレッドシートのリンク（https://docs.google.com/spreadsheets/d/1n0JFQsQ-43XMAVgJbGt87DiFEqAkdo_jBRLLfgKiy7Q/edit?usp=sharing）を入れてください。

＜出力フォーマット＞
Slackに投稿するため、以下のフォーマットルールを厳守してください。
- 見出しは「1. 📌 見出しテキスト」のように番号+絵文字付きにする（例: 🤝 連携、🤖 AI活用、📝 改善、💡 学び、🚀 成果、⚠️ 課題）
- 箇条書きは「• 」（中黒 + 半角スペース）で始める。箇条書きの先頭に絵文字は付けない
- 重要なキーワードや成果は *太字* にする（アスタリスク1つで囲む、アスタリスクの前後は半角スペース）
- 特に注目すべき成果やキーワードには太字に加えて絵文字を1つ添える（例: *キレイなコード* ✨、*生産性向上* 🚀）
- Markdownの ### や ** は絶対に使わない

＜ログデータ＞
${data}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (result.error) {
    throw new Error(`Gemini API エラー: ${result.error.message}`);
  }

  return result.candidates[0].content.parts[0].text;
}

// ===== Slackに投稿 =====
function postToSlack(message) {
  const payload = {
    text: `📊 *今週の情報まとめ*\n\n${message}`,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  const response = UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, options);

  if (response.getResponseCode() !== 200) {
    throw new Error(`Slack投稿エラー: ${response.getContentText()}`);
  }
}
