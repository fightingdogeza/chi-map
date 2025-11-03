import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "YOUR_ANON_KEY"; // フロントで利用する anonキー
const supabase = createClient(supabaseUrl, supabaseKey);

// 現在ログイン中のユーザー取得
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;
  return session.user;
}

// 初期化
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    alert("ログインが必要です");
    window.location.href = "auth.html";
    return;
  }

  const role = user.user_metadata?.role || "user";

  const content = document.getElementById("content");
  content.innerHTML = role === "admin"
    ? `<h2>管理者ページ</h2><p>すべての投稿を管理できます。</p>`
    : `<h2>一般ユーザー</h2><p>自分の投稿だけ管理できます。</p>`;

  await loadDashboardPins();
}

// 投稿取得・表示
async function loadDashboardPins() {
  const user = await getCurrentUser();
  if (!user) {
    alert("ログインしてください");
    window.location.href = "auth.html";
    return;
  }
  const userRole = user.user_metadata?.role || "user";

  // 自分の投稿または管理者は全件取得
  const { data: pins, error } = await supabase
    .from('hazard_pin')
    .select('*, categories(name)')
    .eq(userRole === 'admin' ? null : 'uid', user.id); // adminは全件

  if (error) {
    console.error("投稿取得エラー:", error);
    return;
  }

  const container = document.getElementById("content");
  // 先頭のタイトル/説明部分は残す
  const header = container.innerHTML;
  container.innerHTML = header;

  pins.forEach(pin => {
    const card = document.createElement("div");
    card.className = "pin-card";
    card.dataset.id = pin.id;

    const categoryName = pin.categories?.name ?? "未分類";

    card.innerHTML = `
      <h3>${pin.title}</h3>
      <p>${pin.description}</p>
      <p><strong>カテゴリー:</strong> ${categoryName}</p>
      <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
      ${pin.image_path ? `<img src="${pin.image_path}" style="max-width:200px;" />` : ''}
      <button>削除</button>
    `;

    const deleteBtn = card.querySelector("button");
    deleteBtn.addEventListener("click", () => deletePinWorker(pin, card));

    container.appendChild(card);
  });
}

// Worker経由で削除
async function deletePinWorker(pin, card) {
  const user = await getCurrentUser();
  if (!user) {
    alert("ログインしてください");
    window.location.href = "auth.html";
    return;
  }
  const userRole = user.user_metadata?.role || "user";

  const response = await fetch("https://delete-pin-worker.yourname.workers.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pinId: pin.id,
      imagePath: pin.image_path,
      userId: user.id,
      userRole: userRole
    }),
  });

  const result = await response.json();
  if (response.ok) {
    alert("削除しました");
    card.remove();
  } else {
    alert(`削除失敗: ${result.error}`);
  }
}

// ナビゲーション
document.getElementById("map").addEventListener('click', () => window.location.href = "index.html");
document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "auth.html";
});

// 初期化実行
init();
