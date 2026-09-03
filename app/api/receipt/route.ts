import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    const base64Data = image.split(",")[1];

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
即食食材（肉・魚・惣菜・割引生鮮品）か保管食材（それ以外）かも判定してください。
説明文は一切つけず、次の形式のJSON配列だけを返してください。
[{"name":"商品名","category":"カテゴリ","price":金額（数値）,"type":"immediate または stored"}]`,
            },
          ],
        },
      ],
    });

    const text = response.text ?? "";
    const jsonText = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(jsonText);

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error(error);

    if (error?.status === 503) {
      return NextResponse.json(
        { error: "Geminiが混み合っています。5分ほど待ってからもう一度お試しください。" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "解析に失敗しました" }, { status: 500 });
  }
}