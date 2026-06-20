// ===================================
// 東京社数 担当者別RA集計
// GAS Web App 経由で取得
// ===================================

const GAS_URL =
  "https://script.google.com/a/macros/hokiraon.jp/s/AKfycbwFApsDnbg-lrbM6U6coC1TFrc5Vva4ua2Dcbw9CEhkquTGupf7Y_wEzg1CNTtLIOh4/exec";

export interface StaffRakudenStats {
  staff: string;
  listCount: number;
  apoCount: number;
  apoRate: string;
  hitAriCount: number;
  hitAriRate: string;
  totalCount: number;
  totalRate: string;
}

export interface RakudenSummary {
  rows: StaffRakudenStats[];
  total: StaffRakudenStats;
  fetchedAt: string;
}

export async function getRakudenSummary(): Promise<RakudenSummary | null> {
  try {
    const res = await fetch(GAS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.rows?.length) return null;
    return json as RakudenSummary;
  } catch (error) {
    console.error("GAS rakuden fetch error:", error);
    return null;
  }
}

export function isSheetsConnected(): boolean {
  return true;
}
