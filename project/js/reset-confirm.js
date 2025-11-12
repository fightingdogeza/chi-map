let supabase = null;

// --- Supabase初期化（Workers経由） ---
async function initSupabase() {
  // Supabaseライブラリをグローバルから参照
  if (typeof window.supabase === 'undefined') {
    console.error("Supabaseライブラリが読み込まれていません。");
    alert("supabase-jsのCDNがHTMLに読み込まれているか確認してください。");
    return;
  }

  // Workerから環境変数を取得
  const res = await fetch('https://delete-pin-worker.chi-map.workers.dev/init-supabase');
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SupabaseのURLまたはキーが取得できません。");
  }

  // Supabaseクライアント初期化
  supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
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

// 実行
main().catch((err) => {
  console.error(err);
  document.getElementById("status").textContent = "初期化に失敗しました。";
});
