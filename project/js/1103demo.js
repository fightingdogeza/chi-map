// --- Supabase 初期化 ---
const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dHpoc3ZjeXRxdXpoemR1dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTczMzEsImV4cCI6MjA3NjM5MzMzMX0.TnqtjeGLezpoPKNuc1q5ooIMiwneZjrEf4j0j5z3a4c"; // 必要に応じて置き換え
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- グローバル変数 ---
let map;
let tempMarker = null;
let modalOpen = false;
let selectedLatLng = null;
let markers = [];
let infoWindow = null;

// --- 下部メニュー ---
const navLoginBtn = document.getElementById('nav-login');

// --- 現在のログインユーザー取得 ---
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;
  return session.user;
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

    const user = await getCurrentUser();
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

    const user = await getCurrentUser();
    if (!user) {
      alert("ログインが切れています。再度ログインしてください。");
      window.location.href = "auth.html";
      return;
    }

    let image_path = null;
    if (fileInput.files.length > 0) image_path = await uploadHazardImage(fileInput.files[0]);

    const { data, error } = await supabase.from('hazard_pin').insert([{
      title,
      description,
      category_id,
      created_at: new Date().toISOString(),
      lat: selectedLatLng.lat(),
      lng: selectedLatLng.lng(),
      image_path,
      uid: user.id
    }]).select();

    if (error) { 
      console.error("投稿エラー:", error);
      alert("投稿に失敗しました。");
      return;
    }

    alert("投稿が完了しました！");
    closeModal();
    await loadPins();
  });
}

// --- ピン読み込み + 削除対応（Public） ---
async function loadPins() {
  const { data: pins, error } = await supabase
    .from('hazard_pin')
    .select('*, categories(name)');

  if (error) { 
    console.error("ピン取得エラー:", error); 
    return; 
  }

  markers.forEach(m => m.setMap(null));
  markers = [];
  if (!infoWindow) infoWindow = new google.maps.InfoWindow();

  const user = await getCurrentUser();

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
          ${showDelete ? `<button id="deleteBtn">削除</button>` : ''}
        </div>
      `;
      infoWindow.setContent(content);
      infoWindow.open(map, marker);

      if (showDelete) {
        setTimeout(() => {
          const btn = document.getElementById("deleteBtn");
          if (!btn) return;
          btn.addEventListener("click", async () => {
            // --- Storage の画像削除 ---
            if (pin.image_path) {
              const filePath = pin.image_path.split('/').slice(-2).join('/');
              const { error: storageError } = await supabase.storage.from('pin-images').remove([filePath]);
              if (storageError) console.error("画像削除失敗:", storageError);
            }

            // --- テーブル削除 ---
            const currentUser = await getCurrentUser();
            if (!currentUser || currentUser.id !== pin.uid) {
              alert("削除権限がありません");
              return;
            }

            const { error } = await supabase.from('hazard_pin').delete().eq('id', pin.id);
            if (error) {
              alert("削除できませんでした");
              console.error(error);
            } else {
              alert("削除しました");
              marker.setMap(null);
              infoWindow.close();
            }
          });
        }, 100);
      }
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

// --- 下部メニュー ---
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

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    navLoginBtn.textContent = "ダッシュボード";
    navLoginBtn.onclick = () => window.location.href = "dashboard.html";
  } else {
    navLoginBtn.textContent = "ログイン";
    navLoginBtn.onclick = () => window.location.href = "auth.html";
  }
});
