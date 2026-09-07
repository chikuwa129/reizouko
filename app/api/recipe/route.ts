import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { logApiCall, getRemainingQuota, getResetTimeInJST } from "../../lib/geminiQuota";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json(); // 期限が近い食材名のリスト

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "対象の食材がありません" }, { status: 400 });
    }

    await logApiCall();

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `以下は冷蔵庫にある、賞味期限が近い食材のリストです。
これらの食材をできるだけ多く使い切れる家庭料理のレシピを1〜3件提案してください。
特別な調味料や入手困難な食材は使わず、家庭に常備されがちな調味料（醤油・塩・砂糖・油など）の使用は許容してください。
説明文は一切つけず、次の形式のJSON配列だけを返してください。

[{"title":"レシピ名","uses":["使う食材名（リストの中から）"],"steps":["手順1","手順2","手順3"]}]

食材リスト：
${items.join("、")}`,
            },
          ],
        },
      ],
    });

    const text = response.text ?? "";
    const jsonText = text.replace(/```json|```/g, "").trim();
    const recipes = JSON.parse(jsonText);
    const remaining = await getRemainingQuota();

    return NextResponse.json({ recipes, remaining });
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

    return NextResponse.json({ error: "提案に失敗しました" }, { status: 500 });
  }
}