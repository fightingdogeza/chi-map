// Supabase 初期化
const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dHpoc3ZjeXRxdXpoemR1dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTczMzEsImV4cCI6MjA3NjM5MzMzMX0.TnqtjeGLezpoPKNuc1q5ooIMiwneZjrEf4j0j5z3a4c";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// グローバル変数
let map;
let tempMarker = null;
let modalOpen = false;
let selectedLatLng = null;
let markers = [];
let infoWindow = null;

// 下部メニューのログインボタン
const navLoginBtn = document.getElementById('nav-login');

// --- ログイン状態チェック ---
async function checkLogin() {
  const { data: { session } } = await supabase.auth.getSession();
  return session !== null;
}


// --- Google Map 初期化 ---
window.initMap = function () {
  const initialLatLng = { lat: 35.6811673, lng: 139.7670516 }; // 東京駅
  map = new google.maps.Map(document.getElementById("map"), {
    center: initialLatLng,
    zoom: 15,
  });

  // マップクリック時
  map.addListener("click", async function (e) {
    if (modalOpen) return;

    const loggedIn = await checkLogin(); // クリック時のみ確認
    if (!loggedIn) {
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

  // 現在地取得
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => console.warn("位置情報取得失敗:", err.message)
    );
  }

  // --- 重要: ピン読み込みは常に呼ぶ ---
  loadPins();
  startRealtimeListener();
  // 下部メニュー更新は独立
  updateNavMenu();
};

// --- modal.html を読み込む ---
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

// モーダル表示/非表示
function openModal() { modalOpen = true; document.getElementById("pinModal").style.display = 'block'; }
function closeModal() { 
  modalOpen = false; 
  const modal = document.getElementById("pinModal");
  modal.style.display = "none"; 
  if (tempMarker) { tempMarker.setMap(null); tempMarker = null; }
}

// --- 画像アップロード ---
async function uploadHazardImage(file) {
  if (!file) return null;
  const fileName = `user_uploads/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('pin-images').upload(fileName, file);
  if (error) return null;
  const { data: publicUrlData, error: urlError } = supabase.storage.from('pin-images').getPublicUrl(fileName);
  if (urlError) return null;
  return publicUrlData.publicUrl;
}

// --- 投稿フォームセットアップ ---
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

    let image_path = null;
    if (fileInput.files.length > 0) image_path = await uploadHazardImage(fileInput.files[0]);

    const { data, error } = await supabase.from('hazard_pin').insert([{
      title,
      description,
      category_id,
      created_at: new Date().toISOString(),
      lat: selectedLatLng.lat(),
      lng: selectedLatLng.lng(),
      image_path
    }]).select();

    if (error) { alert("投稿に失敗しました。"); return; }
    alert("投稿が完了しました！");
    closeModal();
    await loadPins();
  });
}

// --- 既存ピン読み込み ---
async function loadPins() {
  const { data: pins, error } = await supabase.from('hazard_pin').select(`*, categories!inner(name)`);
  if (error) { console.error("ピン取得エラー:", error); return; }

  markers.forEach(m => m.setMap(null));
  markers = [];
  if (!infoWindow) infoWindow = new google.maps.InfoWindow();

  pins.forEach(pin => {
    const marker = new google.maps.Marker({
      position: { lat: pin.lat, lng: pin.lng },
      map: map,
      title: pin.title
    });

    marker.addListener("click", () => {
      const categoryName = pin.categories?.name ?? "未分類";
      const content = `
        <div>
          <h3>${pin.title}</h3>
          <p>${pin.description}</p>
          <p><strong>カテゴリー:</strong> ${categoryName}</p>
          <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
          ${pin.image_path ? `<img src="${pin.image_path}" style="max-width:200px;">` : ''}
        </div>
      `;
      infoWindow.setContent(content);
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  });
}

// --- リアルタイム監視 ---
function startRealtimeListener() {
  supabase.channel('hazard_pin_changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazard_pin' }, payload => {
      const pin = payload.new;
      new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: map,
        icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
        title: pin.title
      });
    })
    .subscribe();
}

// --- 下部メニュー更新 ---
// 下部メニュー更新
async function updateNavMenu() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    navLoginBtn.textContent = "ダッシュボード";
    navLoginBtn.onclick = () => window.location.href = "dashboard.html";
  } else {
    navLoginBtn.textContent = "ログイン";
    navLoginBtn.onclick = () => window.location.href = "auth.html";
  }
}
// セッション変化を監視してリアルタイムに下部メニューを更新
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    navLoginBtn.textContent = "ダッシュボード";
    navLoginBtn.onclick = () => window.location.href = "dashboard.html";
  } else {
    navLoginBtn.textContent = "ログイン";
    navLoginBtn.onclick = () => window.location.href = "auth.html";
  }
});
