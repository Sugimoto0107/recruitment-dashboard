import { getRakudenSummary } from "@/lib/sheets";

export const revalidate = 3600; // 1時間キャッシュ

export async function GET() {
  const data = await getRakudenSummary();
  if (!data) {
    return Response.json({ error: "未設定またはデータなし", rows: [], total: null }, { status: 200 });
  }
  return Response.json(data);
}
