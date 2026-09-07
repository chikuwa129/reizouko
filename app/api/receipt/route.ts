import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { logApiCall, getRemainingQuota, getResetTimeInJST, sleep } from "../../lib/geminiQuota";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateWithRetry(base64Data: string, maxRetries = 1) {
  const delays = [5000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await logApiCall();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Data } },
              {
                text: `このレシート画像から情報を抽出してください。
レシートに印字されている購入日（年月日）を読み取り、"YYYY-MM-DD"形式にしてください。年の記載がない場合は今年として補完してください。日付が読み取れない場合はnullにしてください。
商品については、略称は正式名称に補正してください（例:「Cメシ」→「完全メシ」）。
食材については、即食食材（肉・魚・惣菜・割引生鮮品）か保管食材（それ以外）かを判定してください。
レジ袋・箸・スプーンなど食材ではない付帯品は、typeを"non_food"としてください。
個数の記載があれば読み取り、なければ1としてください。
説明文は一切つけず、次の形式のJSONオブジェクトだけを返してください。
{"purchase_date":"YYYY-MM-DD または null","items":[{"name":"商品名","category":"カテゴリ","price":金額（数値）,"type":"immediate、stored、non_food のいずれか","quantity":個数（数値）}]}`,
              },
            ],
          },
        ],
      });
      return response;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      if (error?.status === 503 && !isLastAttempt) {
        await sleep(delays[attempt]);
        continue;
      }
      throw error;
    }
  }
  throw new Error("リトライ上限に達しました");
}

export async function GET() {
  const remaining = await getRemainingQuota();
  return NextResponse.json({ remaining });
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const base64Data = image.split(",")[1];

    const response = await generateWithRetry(base64Data);

    const text = response.text ?? "";
    const jsonText = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText);
    const remaining = await getRemainingQuota();

    return NextResponse.json({
      items: parsed.items,
      purchaseDate: parsed.purchase_date ?? null,
      remaining,
    });
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