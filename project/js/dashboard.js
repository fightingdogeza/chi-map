import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dHpoc3ZjeXRxdXpoemR1dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTczMzEsImV4cCI6MjA3NjM5MzMzMX0.TnqtjeGLezpoPKNuc1q5ooIMiwneZjrEf4j0j5z3a4c"; // anonキー
const supabase = createClient(supabaseUrl, supabaseKey);


// 現在のログインユーザー取得
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;
  return session.user;
}

// 初期化
async function init() {
  const user = await getCurrentUser();
  if (!user) {
    alert("ログインが必要です。");
    window.location.href = "auth.html";
    return;
  }

  const role = user.user_metadata?.role || "user";
  const content = document.getElementById("content");

  if (role === "admin") {
    content.innerHTML = `<h2>管理者ページ</h2><p>すべての投稿を管理できます。</p>`;
    await loadAllPinsForAdmin();
  } else {
    content.innerHTML = `<h2>一般ユーザー</h2><p>自分の投稿だけ管理できます。</p>`;    
    await loadDashboardPins();
  }
}

// ------------------ Worker 経由削除関数 ------------------
async function deletePin(pin) {
  const user = await getCurrentUser();
  if (!user) {
    alert("ログインしてください");
    window.location.href = "auth.html";
    return;
  }

  const response = await fetch('https://delete-pin-worker.yourname.workers.dev/delete-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pinId: pin.id,
      userId: user.id,
      role: user.user_metadata?.role || 'user',
      imagePath: pin.image_path
    })
  });

  const result = await response.json();

  if (result.success) {
    alert('削除しました');
    document.getElementById(`pin-${pin.id}`).remove();
  } else {
    alert(result.error || '削除できませんでした');
  }
}

// ------------------ 自分の投稿を取得 ------------------
async function loadDashboardPins() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: pins, error } = await supabase
    .from('hazard_pin')
    .select('*, categories(name)')
    .eq('uid', user.id);

  if (error) {
    console.error("投稿取得エラー:", error);
    return;
  }

  renderPins(pins);
}

// ------------------ 管理者用 全投稿取得 ------------------
async function loadAllPinsForAdmin() {
  const response = await fetch('https://delete-pin-worker.yourname.workers.dev/get-all-pins', {
    method: 'GET',
    headers: { 'x-user-role': 'admin' }
  });

  const pins = await response.json();
  renderPins(pins);
}

// ------------------ 投稿カード描画 ------------------
function renderPins(pins) {
  const container = document.getElementById("content");
  container.innerHTML = "";

  pins.forEach(pin => {
    const card = document.createElement("div");
    card.id = `pin-${pin.id}`;
    card.className = "pin-card";

    const categoryName = pin.categories?.name ?? "未分類";

    card.innerHTML = `
      <h3>${pin.title}</h3>
      <p>${pin.description}</p>
      <p><strong>カテゴリー:</strong> ${categoryName}</p>
      <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
      ${pin.image_path ? `<img src="${pin.image_path}" />` : ''}
      <button>削除</button>
    `;

    card.querySelector("button").addEventListener("click", () => deletePin(pin));
    container.appendChild(card);
  });
}

// ------------------ イベント ------------------
document.getElementById("map").addEventListener('click', () => {
  window.location.href = "index.html";
});

document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "auth.html";
});

// ------------------ 初期化呼び出し ------------------
init();