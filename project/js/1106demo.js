// --- グローバル変数 ---
let map;
let tempMarker = null;
let modalOpen = false;
let selectedLatLng = null;
let markers = [];
let infoWindow = null;
let supabase = null;
let access_token = null;
let refresh_token = null;
let user = null;

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



// --- 下部メニュー ---
const navLoginBtn = document.getElementById('nav-login');

// --- 現在のログインユーザー取得 ---
async function getCurrentUser() {
  getTokens();

  if (!access_token) {
    return null;
  }

  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "X-Refresh-Token": refresh_token,
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
    }

    return data.user;

  } catch (err) {
    console.error("通信エラー:", err);
    return null;
  }
}

// --- Google Map 初期化 ---
window.initMap = function () {
  const initialLatLng = { lat: 35.6811673, lng: 139.7670516 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: initialLatLng,
    zoom: 15,
  });

  loadPins();
  startRealtimeListener();
  updateNavMenu();

  map.addListener("click", async function (e) {
    if (modalOpen) return;

    user = await getCurrentUser();
    if (!user) {
      alert("ログインしてください");
      window.location.href = "auth.html";
      return;
    }

    selectedLatLng = e.latLng;
    if (!document.getElementById("pinModal")) {
      loadModal().then(openModal);
    } else {
      openModal();
    }
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => console.warn("位置情報取得失敗:", err.message)
    );
  }
};

// --- modal.html 読み込み ---
function loadModal() {
  return fetch("modal.html")
    .then(res => res.text())
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      setupPost();
      document.getElementById("cancelBtn").addEventListener("click", closeModal);
    })
    .catch(error => console.error("モーダル読み込み失敗:", error));
}

function openModal() {
  modalOpen = true; document.getElementById("pinModal").style.display = 'block';
}

function closeModal() {
  modalOpen = false;
  const modal = document.getElementById("pinModal");
  modal.style.display = "none";
  if (tempMarker) { tempMarker.setMap(null); tempMarker = null; }
}
// --- 投稿フォーム ---
function setupPost() {
  const form = document.getElementById("pinForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedLatLng) { alert("地図をクリックして位置を選択してください。"); return; }

    const title = document.getElementById("title").value;
    const category_id = document.getElementById("category").value;
    const description = document.getElementById("description").value;
    const fileInput = document.getElementById("image");

    if (category_id === "none") { alert("カテゴリを選択してください"); return; }

    user = await getCurrentUser();
    if (!user) {
      alert("ログインが切れています。再度ログインしてください。");
      window.location.href = "auth.html";
      return;
    }
    let formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("category_id", category_id);
    formData.append("lat", selectedLatLng.lat());
    formData.append("lng", selectedLatLng.lng());
    formData.append("uid", user.id);
    if (fileInput.files.length > 0) {
      formData.append("image", fileInput.files[0]);
    }
    try {
      const response = await fetch("https://delete-pin-worker.chi-map.workers.dev/post-pin", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (result.success) {
        alert("投稿が完了しました！");
        closeModal();
        await loadPins();
      } else {
        console.error("投稿エラー:", result.error);
        alert("投稿に失敗しました。");
      }
    } catch (err) {
      console.error("投稿例外:", err);
      alert("投稿に失敗しました。");
    }
  });
}
// --- ピン読み込み + 削除対応（Public） ---
async function loadPins() {
  const response = await fetch('https://delete-pin-worker.chi-map.workers.dev/get-all-pins', {
    headers: { "Content-Type": "application/json" }
  });
  const text = await response.text();
  let pins;
  try {
    pins = JSON.parse(text);
  } catch {
    return;
  }
  markers.forEach(m => m.setMap(null));
  markers = [];
  if (!infoWindow) infoWindow = new google.maps.InfoWindow();

  user = await getCurrentUser();

  pins.forEach(pin => {
    const marker = new google.maps.Marker({
      position: { lat: pin.lat, lng: pin.lng },
      map: map,
      title: pin.title
    });

    marker.addListener("click", () => {
      const categoryName = pin.categories?.name ?? "未分類";
      const showDelete = user && user.id === pin.uid;
      const content = `
        <div>
          <h3>${pin.title}</h3>
          <p>${pin.description}</p>
          <p><strong>カテゴリー:</strong> ${categoryName}</p>
          <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
          ${pin.image_path ? `<img src="${pin.image_path}" style="max-width:200px;">` : ''}
          ${showDelete ? `<br><button id="deleteBtn">削除</button>` : ''}
        </div>
      `;
      infoWindow.setContent(content);
      infoWindow.open(map, marker);

      if (showDelete) {
        setTimeout(() => {
          const btn = document.getElementById("deleteBtn");
          if (!btn) return;
          btn.addEventListener("click", async () => {
            if (!user || user.id !== pin.uid) {
              alert("削除権限がありません");
              return;
            }
            getTokens();
            if (!access_token || !refresh_token) {
              alert("ログイン情報が無効です。再ログインしてください。");
              return;
            }
            // --- Storage の画像削除 ---
            const response = await fetch('https://delete-pin-worker.chi-map.workers.dev/delete-pin', {
              method: "POST",
              headers: { "Content-Type": "application/json, charset=UTF-8" },
              body: JSON.stringify({
                id: pin.id,
                imagePath: pin.image_path,
                access_token,
                refresh_token
              }),
            });

            const result = await response.json();
            if (!response.ok) {
              alert("削除に失敗しました: " + (result.error || "不明なエラー"));
              console.error(result.error);
              return;
            }
            alert(result.warning);
            alert("削除しました");
            marker.setMap(null);
            infoWindow.close();
          });
        }, 100);
      }
    });
    markers.push(marker);
  });
}

function startRealtimeListener() {
  const eventSource = new EventSource("https://delete-pin-worker.chi-map.workers.dev/realtime");

  eventSource.onmessage = (event) => {
    const pin = JSON.parse(event.data);
    // Google Maps に追加
    new google.maps.Marker({
      position: { lat: Number(pin.lat), lng: Number(pin.lng) },
      map: map,
      icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
      title: pin.title,
    });
  };

  eventSource.onerror = (err) => {
    console.error("SSEエラー:", err);
    eventSource.close();
  };
}

async function updateNavMenu() {
  try {
    user = await getCurrentUser();
    if (!user) {
      // 未ログイン時
      navLoginBtn.textContent = "ログイン";
      navLoginBtn.onclick = () => window.location.href = "auth.html";
      return;
    }
    // --- ログイン中UI反映 ---
    navLoginBtn.textContent = "一覧";
    navLoginBtn.onclick = () => window.location.href = "dashboard.html";
  } catch (error) {
    console.error("ログイン確認エラー:", error);

    navLoginBtn.textContent = "ログイン";
    navLoginBtn.onclick = () => window.location.href = "auth.html";
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initSupabase();
    await updateNavMenu();
  } catch (err) {
    console.error("初期化エラー:", err);
  }
});

function getTokens() {
  access_token = localStorage.getItem("access_token");
  refresh_token = localStorage.getItem("refresh_token");
}