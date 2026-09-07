import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { title, uses, steps } = await req.json();

    const { error } = await supabase.from("recipes").insert({
      title,
      uses: uses.join("、"),
      steps: steps.join("\n"),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}