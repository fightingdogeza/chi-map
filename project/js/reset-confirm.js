// reset-confirm.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Supabase初期化（Workers経由） ---
async function initSupabase() {
  const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/init-supabase");
  if (!res.ok) throw new Error("Supabase情報の取得に失敗しました。");
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function main() {
  const supabase = await initSupabase();
  const statusEl = document.getElementById("status");

  // --- セッション確認 ---
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
    if (error) {
      statusEl.textContent = "リンクの有効期限が切れています。";
      return;
    }
  }

  // --- パスワード更新 ---
  document.getElementById("newPassForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("new-password").value;
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      statusEl.textContent = "変更に失敗しました: " + error.message;
    } else {
      statusEl.textContent = "パスワードを変更しました。ログイン画面に戻ってください。";
    }
  });
}

// 実行
main().catch((err) => {
  console.error(err);
  document.getElementById("status").textContent = "初期化に失敗しました。";
});
