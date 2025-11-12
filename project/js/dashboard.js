
// ================== Supabase 初期化 ==================
let supabase = null;

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

// ------------------ 現在のログインユーザー取得 ------------------
// --- 現在のログインユーザー取得 ---
async function getCurrentUser() {
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");

  if (!access_token) {
    console.log("トークンが存在しません。未ログイン状態です。");
    return null;
  }

  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "X-Refresh-Token": refresh_token, // refresh_tokenを一緒に送信
      },
    });

    const data = await res.json();

    // --- 無効または期限切れ ---
    if (!res.ok || !data.loggedIn) {
      console.warn("認証エラー:", data.message || data.error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return null;
    }

    // --- 新しいトークンが返ってきた場合、更新 ---
    if (data.new_access_token) {
      localStorage.setItem("access_token", data.new_access_token);
      localStorage.setItem("refresh_token", data.new_refresh_token);
      console.log("トークンを更新しました");
    }

    console.log("ログイン中:", data.user);
    return data.user;

  } catch (err) {
    console.error("通信エラー:", err);
    return null;
  }
}

// ------------------ 初期化 ------------------
async function init() {
  await initSupabase(); // ← まずここでSupabaseを初期化
  if (!supabase) {
    alert("Supabaseの初期化に失敗しました。");
    return;
  }
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
    await loadDashboardPins(user.id);
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
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  console.log(pin.id,pin.image_path,access_token,refresh_token);
  
  const response = await fetch('https://delete-pin-worker.chi-map.workers.dev/delete-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: pin.id,
      imagePath: pin.image_path,
      access_token,
      refresh_token
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
// ------------------ 管理者用 全投稿取得 ------------------
async function loadAllPinsForAdmin() {
  const response = await fetch('https://delete-pin-worker.chi-map.workers.dev/get-all-pins', {
    headers: { 'x-user-role': 'admin' }
  });
  const pins = await response.json();
  renderPins(pins);
}
// ------------------ 自分の投稿を取得 ------------------
async function loadDashboardPins(userId) {
  const response = await fetch('https://delete-pin-worker.chi-map.workers.dev/get-user-pins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
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
      ${pin.image_path ? `<img src="${pin.image_path}" style="max-width:200px;" />` : ''}
      <br><button>削除</button>
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
  await setupLogout();
  localStorage.removeItem('supabase_session');
  window.location.href = "auth.html";
});
async function setupLogout() {
  await initSupabase();

  const logoutBtn = document.getElementById("logout");
  if (!logoutBtn) {
    console.warn("ログアウトボタンが見つかりません。");
    return;
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      // Supabaseセッションの無効化
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // ローカルストレージのセッション情報を削除
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      alert("ログアウトしました。");
      window.location.href = "auth.html"; // ログインページに戻す
    } catch (err) {
      alert("ログアウトに失敗しました: " + err.message);
    }
  });
}

// ------------------ 初期化呼び出し ------------------
init();
