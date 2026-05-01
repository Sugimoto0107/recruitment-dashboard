// ===================================
// /api/revalidate
// GitHub Actions cron からトークン付きで叩かれてダッシュボードキャッシュを更新する
//
// 使い方:
//   GET /api/revalidate?token=YOUR_SECRET
//   (環境変数 REVALIDATE_TOKEN と一致する必要あり)
// ===================================

import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const expected = process.env.REVALIDATE_TOKEN;
  if (!expected) {
    return Response.json(
      { ok: false, error: "REVALIDATE_TOKEN is not configured" },
      { status: 500 }
    );
  }
  if (!token || token !== expected) {
    return Response.json(
      { ok: false, error: "Invalid token" },
      { status: 401 }
    );
  }

  try {
    // ダッシュボードAPIとTOPページの両方を再生成対象に
    revalidatePath("/api/dashboard");
    revalidatePath("/");
    return Response.json({
      ok: true,
      revalidated: ["/api/dashboard", "/"],
      now: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Revalidate error:", error);
    return Response.json(
      { ok: false, error: "Revalidation failed" },
      { status: 500 }
    );
  }
}
