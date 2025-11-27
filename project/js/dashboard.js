let supabase = null;
let pins = [];
let res;
let user;
let access_token;
async function initSupabase() {
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
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: { debug: false }
    });
    return supabase;
  } catch (err) {
    console.error(" Supabase初期化エラー:", err);
    alert("Supabaseの初期化に失敗しました。");
  }
}

async function getCurrentUser() {
  access_token = localStorage.getItem("access_token");
  if (!access_token) {
    return null;
  }
  try {
    const res = await fetch("https://environment.chi-map.workers.dev/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return null;
    }
    return data.user;
  } catch (err) {
    return null;
  }
}

async function init() {
  await initSupabase();
  if (!supabase) return;
  user = await getCurrentUser();
  if (!user) {
    alert("ログインが必要です。");
    window.location.href = "https://chi-map.pages.dev/auth";
    return;
  }
  if (user.role === "admin") {
    await loadAllPinsForAdmin();
  } else {
    await loadDashboardPins(user.id);
  }
}

async function deletePin(pin) {
  if (!user) {
    alert("ログインしてください");
    window.location.href = "https://chi-map.pages.dev/auth";
    return;
  }
  access_token = localStorage.getItem("access_token");
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/delete-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        id: pin.id,
        imagePath: pin.image_path,
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
async function loadAllPinsForAdmin() {
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/get-all-pins", {
      headers: {
        "Authorization": `Bearer ${access_token}`,
      },
    });
    res = await response.json();
  } catch (err) {
    console.error("全投稿取得エラー:", err);
  }
  pins = Array.isArray(res.data) ? res.data : [];
  renderPins(pins);
}

async function loadDashboardPins(userId) {
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/get-user-pins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
      },
      body: JSON.stringify({ userId }),
    });
    res = await response.json();
  } catch (err) {
    console.error("自分の投稿取得エラー:", err);
  }
  pins = Array.isArray(res.data) ? res.data : [];
  renderPins(pins);
}

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
    card.querySelector(".delete-btn").addEventListener("click", () => {
      card.querySelector(".delete-btn").disabled = "false";
      deletePin(pin);
      card.querySelector(".delete-btn").disabled = "true";

    });
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

document.getElementById("logout").addEventListener("click", async () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("supabase_session");

  alert("ログアウトしました。");
  window.location.href = "https://chi-map.pages.dev/auth";
});
init();
