// ===================================
// /api/refresh
// 画面の「更新」ボタンから呼ばれ、ダッシュボードのキャッシュを破棄する。
// この直後に /api/dashboard を取得すると Notion から取り直した最新データが返る。
//
// GitHub Actions 用の /api/revalidate（トークン必須）とは別に、
// クライアントから安全に叩ける POST 専用の内部エンドポイント。
// ===================================

import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    revalidatePath("/api/dashboard");
    revalidatePath("/");
    return Response.json({ ok: true, now: new Date().toISOString() });
  } catch (error) {
    console.error("Refresh error:", error);
    return Response.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
