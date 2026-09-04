import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini無料枠のリセット時刻（太平洋時間の深夜0時）を日本時間の文字列で返す
function getResetTimeInJST(): string {
  const now = new Date();

  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  });
  const offsetPart = offsetFormatter.formatToParts(now).find((p) => p.type === "timeZoneName");
  const offsetHours = parseInt(offsetPart?.value.replace("GMT", "") || "-8", 10);

  const ptNow = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  const nextResetPT = new Date(
    Date.UTC(ptNow.getUTCFullYear(), ptNow.getUTCMonth(), ptNow.getUTCDate() + 1, 0, 0, 0)
  );
  const nextResetUTC = new Date(nextResetPT.getTime() - offsetHours * 60 * 60 * 1000);

  return nextResetUTC.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function generateWithRetry(base64Data: string, maxRetries = 3) {
  const delays = [3000, 8000, 15000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Data } },
              {
                text: `このレシート画像から購入した商品情報を抽出してください。
略称は正式名称に補正してください（例:「Cメシ」→「完全メシ」）。
食材については、即食食材（肉・魚・惣菜・割引生鮮品）か保管食材（それ以外）かを判定してください。
レジ袋・箸・スプーンなど食材ではない付帯品は、typeを"non_food"としてください。
個数の記載があれば読み取り、なければ1としてください。
説明文は一切つけず、次の形式のJSON配列だけを返してください。
[{"name":"商品名","category":"カテゴリ","price":金額（数値）,"type":"immediate、stored、non_food のいずれか","quantity":個数（数値）}]`,
              },
            ],
          },
        ],
      });
      return response;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      if (error?.status === 503 && !isLastAttempt) {
        console.log(`503のため再試行します（${attempt + 1}回目）`);
        await sleep(delays[attempt]);
        continue;
      }
      throw error;
    }
  }
  throw new Error("リトライ上限に達しました");
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const base64Data = image.split(",")[1];

    const response = await generateWithRetry(base64Data);

    const text = response.text ?? "";
    const jsonText = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(jsonText);

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error(error);

    if (error?.status === 429) {
      const resetTime = getResetTimeInJST();
      return NextResponse.json(
        { error: `本日のGemini無料枠の上限に達しました。次にリセットされるのは日本時間で${resetTime}ごろです。` },
        { status: 429 }
      );
    }

    if (error?.status === 503) {
      return NextResponse.json(
        { error: "Geminiが混み合っています。5分ほど待ってからもう一度お試しください。" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "解析に失敗しました" }, { status: 500 });
  }
}