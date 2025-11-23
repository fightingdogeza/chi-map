let supabase = null;
let pins = [];
let res;
const user = await getCurrentUser();

async function initSupabase() {
  // Supabaseライブラリが読み込まれているか確認
  if (typeof window.supabase === "undefined") {
    console.error("Supabaseライブラリが読み込まれていません。");
    return;
  }

  try {
    const res = await fetch("https://environment.chi-map.workers.dev/init-supabase");
    const { supabaseUrl, supabaseAnonKey } = await res.json();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SupabaseのURLまたはキーが取得できません。");
    }
    // Supabaseクライアント初期化
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    return supabase;
  } catch (err) {
    console.error(" Supabase初期化エラー:", err);
    alert("Supabaseの初期化に失敗しました。");
  }
}

//現在のログインユーザー取得
async function getCurrentUser() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    console.log("トークンが存在しません。未ログイン状態です。");
    return null;
  }
  try {
    const res = await fetch("https://environment.chi-map.workers.dev/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      console.warn("認証エラー:", data.error);
      return null;
    }

    return data.user;
  } catch (err) {
    console.error("ユーザー情報取得エラー:", err);
    return null;
  }
}

//初期化
async function init() {
  await initSupabase();
  if (!supabase) return;
  if (!user) {
    alert("ログインが必要です。");
    window.location.href = "https://chi-map.pages.dev/auth";
    return;
  }

  console.log(user);
  if (user.role === "admin") {
    await loadAllPinsForAdmin();
  } else {
    await loadDashboardPins(user.id);
  }
}

//投稿削除
async function deletePin(pin) {
  if (!user) {
    alert("ログインしてください");
    window.location.href = "https://chi-map.pages.dev/auth";
    return;
  }

  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/delete-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pin.id,
        imagePath: pin.image_path,
        access_token,
        refresh_token,
        role: user.role,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert("削除しました");
      document.getElementById(`pin-${pin.id}`)?.remove();
    } else {
      alert(result.error || "削除できませんでした");
    }
  } catch (err) {
    console.error("削除エラー:", err);
    alert("削除中にエラーが発生しました。");
  }
}

//管理者用 全投稿取得
async function loadAllPinsForAdmin() {
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/get-all-pins", {
      headers: { "x-user-role": "admin" },
    });
    res = await response.json();
  } catch (err) {
    console.error("全投稿取得エラー:", err);
  }
  pins = Array.isArray(res.data) ? res.data : [];
  renderPins(pins);
}

//自分の投稿を取得
async function loadDashboardPins(userId) {
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/get-user-pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    res = await response.json();
  } catch (err) {
    console.error("自分の投稿取得エラー:", err);
  }
  pins = Array.isArray(res.data) ? res.data : [];
  renderPins(pins);
}

//投稿カード描画
function renderPins(pins) {
  const container = document.getElementById("content");
  container.innerHTML = "";

  if (!pins || pins.length === 0) {
    container.innerHTML = "<p>投稿がありません。</p>";
    return;
  }

  pins.forEach((pin) => {
    const card = document.createElement("div");
    card.id = `pin-${pin.id}`;
    card.className = "pin-card";
    card.dataset.lat = pin.lat;
    card.dataset.lng = pin.lng;
    const categoryName = pin.categories?.name ?? "未分類";

    card.innerHTML = `
      <h3>${pin.title}</h3>
      <p>${pin.description}</p>
      <p><strong>カテゴリー:</strong> ${categoryName}</p>
      <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
      ${pin.image_path ? `<img src="${pin.image_path}" style="max-width:200px;" />` : ""}<br>
      <button class="goto-map-btn">地図で見る</button>
      <button class="delete-btn">削除</button>
    `;

    card.querySelector(".delete-btn").addEventListener("click", () =>
      deletePin(pin)
    );
    card.querySelector(".goto-map-btn")
      .addEventListener("click", () => {
        const lat = pin.lat;
        const lng = pin.lng;
        window.location.href = `https://chi-map.pages.dev?from=dashboard&lat=${lat}&lng=${lng}`;
      });
    container.appendChild(card);
  });
}

document.getElementById("map").addEventListener("click", () => {
  window.location.href = "https://chi-map.pages.dev";
});

// ログアウト
document.getElementById("logout").addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Supabase signOutエラー:", err);
  }

  // カスタムトークン削除
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("supabase_session");

  alert("ログアウトしました。");
  window.location.href = "https://chi-map.pages.dev/auth";
});

//初期化呼び出し
init();
