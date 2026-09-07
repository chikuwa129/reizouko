import { supabase } from "./supabase";

export const DAILY_LIMIT = 20;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getPTOffsetHours(): number {
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  });
  const offsetPart = offsetFormatter.formatToParts(new Date()).find((p) => p.type === "timeZoneName");
  return parseInt(offsetPart?.value.replace("GMT", "") || "-8", 10);
}

export function getResetTimeInJST(): string {
  const now = new Date();
  const offsetHours = getPTOffsetHours();
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

export function getStartOfTodayPTAsUTC(): Date {
  const now = new Date();
  const offsetHours = getPTOffsetHours();
  const ptNow = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  const startOfDayPT = new Date(
    Date.UTC(ptNow.getUTCFullYear(), ptNow.getUTCMonth(), ptNow.getUTCDate(), 0, 0, 0)
  );
  return new Date(startOfDayPT.getTime() - offsetHours * 60 * 60 * 1000);
}

export async function logApiCall() {
  await supabase.from("api_calls").insert({});
}

export async function getRemainingQuota(): Promise<number> {
  const startOfDay = getStartOfTodayPTAsUTC();
  const { count } = await supabase
    .from("api_calls")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());
  return Math.max(0, DAILY_LIMIT - (count ?? 0));
}