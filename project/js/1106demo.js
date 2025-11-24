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
let activeFilters = [];
let markerCluster = null;
let pins = [];
const categoryColors = {
  1: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  2: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  3: "https://maps.google.com/mapfiles/ms/icons/ltblue-dot.png",
  4: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  5: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
};
const navLoginBtn = document.getElementById("nav-login");


async function initSupabase() {
  if (typeof window.supabase === "undefined") {
    console.error("Supabaseライブラリが読み込まれていません。");
    alert("supabase-jsのCDNがHTMLに読み込まれているか確認してください。");
    return;
  }

  const res = await fetch("https://environment.chi-map.workers.dev/init-supabase");
  const { supabaseUrl, supabaseAnonKey } = await res.json();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SupabaseのURLまたはキーが取得できません。");
  }

  supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

async function getCurrentUser() {
  getTokens();
  if (!access_token) return null;

  try {
    const res = await fetch("https://environment.chi-map.workers.dev/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "X-Refresh-Token": refresh_token,
      },
    });

    const data = await res.json();

    if (!res.ok || !data.loggedIn) {
      console.warn("認証エラー:", data.message || data.error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      return null;
    }

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

window.initMap = function () {
  const params = new URLSearchParams(window.location.search);
  let from;
  let paramLat;
  let paramLng;
  if (params) {
    from = params.get("from");
    paramLat = parseFloat(params.get("lat"));
    paramLng = parseFloat(params.get("lng"));
  };

  let initialLatLng = { lat: 35.6811673, lng: 139.7670516 };
  if (from === "dashboard" && !isNaN(paramLat) && !isNaN(paramLng)) {
    initialLatLng = { lat: paramLat, lng: paramLng };
  }
  map = new google.maps.Map(document.getElementById("map"), {
    center: initialLatLng,
    zoom: 17,
  });

  loadPins();
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
  if (from !== "dashboard") {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("位置情報取得失敗:", err.message)
      );
    }
  }
};

function loadModal() {
  return fetch("modal.html")
    .then((res) => res.text())
    .then((html) => {
      document.body.insertAdjacentHTML("beforeend", html);
      setupPost();
      document.getElementById("cancelBtn").addEventListener("click", closeModal);
    })
    .catch((error) => console.error("モーダル読み込み失敗:", error));
}

function openModal() {
  modalOpen = true;
  document.getElementById("pinModal").style.display = "block";
}

function closeModal() {
  modalOpen = false;
  const modal = document.getElementById("pinModal");
  modal.style.display = "none";
  if (tempMarker) {
    tempMarker.setMap(null);
    tempMarker = null;
  }
}

function setupPost() {
  const form = document.getElementById("pinForm");
  const btn = document.getElementById("submitBtn");
  form.addEventListener("submit", async (e) => {
    btn.disabled = true;
    e.preventDefault();
    if (!selectedLatLng) {
      alert("地図をクリックして位置を選択してください。");
      btn.disabled = false;
      return;
    }
    const title = document.getElementById("title").value;
    const category_id = document.getElementById("category").value;
    const description = document.getElementById("description").value;
    const fileInput = document.getElementById("image");

    if (category_id === "none") {
      alert("カテゴリを選択してください");
      btn.disabled = false;
      return;
    }
    if (!user) {
      alert("ログインが切れています。再度ログインしてください。");
      btn.disabled = false;
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
      const response = await fetch("https://environment.chi-map.workers.dev/post-pin", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        alert("投稿が完了しました！");
        btn.disabled = false;
        closeModal();
        await loadPins();
      } else {
        console.error("投稿エラー:", result.error);
        alert("投稿に失敗しました。");
        btn.disabled = false;
      }
    } catch (err) {
      console.error("投稿例外:", err);
      alert("投稿に失敗しました。");
      btn.disabled = false;
    }
  });
}
function createMarker(pin) {
  if (!pin) return;
  const lat = Number(pin.lat);
  const lng = Number(pin.lng);
  if (isNaN(lat) || isNaN(lng)) return;
  const iconUrl = categoryColors[Number(pin.category_id)] || null;
  const marker = new google.maps.Marker({
    position: { lat, lng },
    map,
    title: pin.title || "タイトルなし",
    icon: iconUrl,
  });

  marker.pinData = pin;
  marker.addListener("click", () => {

    const pos = marker.getPosition();
    const projection = map.getProjection();

    if (projection) {
      const point = projection.fromLatLngToPoint(pos);
      const scale = Math.pow(2, map.getZoom());
      const pixelOffsetY = -150 / scale;
      const adjustedPoint = new google.maps.Point(
        point.x,
        point.y + pixelOffsetY
      );

      const adjustedLatLng = projection.fromPointToLatLng(adjustedPoint);
      map.panTo(adjustedLatLng);
    } else {
      map.panTo(pos);
    }
    let categoryName = pin.categories?.name ?? "未分類";
    const showDelete = user && user.id === pin.uid;
    const content = `
    <div>
      <h3>${pin.title}</h3>
      <p>${pin.description}</p>
      <p><strong>カテゴリー:</strong> ${categoryName}</p>
      <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
      ${pin.image_path ? `<img src="${pin.image_path}" style="max-width:200px;">` : ""}
      ${showDelete ? `<br><button id="deleteBtn">削除</button>` : ""}
    </div>
  `;

    infoWindow.setContent(content);
    infoWindow.open(map, marker);

    if (showDelete) {
      setTimeout(() => {
        const btn = document.getElementById("deleteBtn");
        if (!btn) return;
        btn.addEventListener("click", () => deletePin(pin, marker));
      }, 100);
    }
  });

  markers.push(marker);
}
async function deletePin(pin, marker) {
  const user = await getCurrentUser();
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
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        id: pin.id,
        imagePath: pin.image_path,
        access_token,
        refresh_token,
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert("削除しました");
      marker.setMap(null);
      document.getElementById(`pin-${pin.id}`)?.remove();
      markers = markers.filter(m => m !== marker);
    } else {
      alert(result.error || "削除できませんでした");
    }
  } catch (err) {
    console.error("削除エラー:", err);
    alert("削除中にエラーが発生しました。");
  }
}

async function loadPins() {
  let res;
  try {
    const response = await fetch("https://environment.chi-map.workers.dev/get-all-pins", {
      headers: { "Content-Type": "application/json" },
    });
    res = await response.json();
  } catch (e) {
    console.error("JSON パース失敗:", e);
    return;
  }
  pins = Array.isArray(res.data) ? res.data : [];
  if (!user) {
    user = getCurrentUser();
  }
  if (activeFilters.length > 0) {
    pins = pins.filter(pin => activeFilters.includes(Number(pin.category_id)));
  }
  renderPins(pins);
}
function renderPins(pins) {
  markers.forEach(m => m.setMap(null));
  markers = [];
  pins.forEach(pin => {
    createMarker(pin)
  });
  if (markerCluster) {
    markerCluster.clearMarkers();
  }
  if (!infoWindow) infoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

  markerCluster = new markerClusterer.MarkerClusterer({
    map,
    markers,
    algorithm: new markerClusterer.SuperClusterAlgorithm({ radius: 80 }),

    renderer: {
      render: ({ count, position, markers }) => {
        const categoryCount = {};
        markers.forEach(m => {
          const cat = m.pinData?.categories?.name || "不明";
          categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });

        const categorySummary = Object.entries(categoryCount)
          .map(([cat, num]) => `${cat}: ${num}`)
          .join(", ");

        return new google.maps.Marker({
          position,
          label: {
            text: String(count),
            color: "white",
            fontSize: "14px",
          },
          title: `クラスタ内のカテゴリ分布 → ${categorySummary}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#4285F4",
            fillOpacity: 0.6,
            strokeWeight: 0,
            scale: Math.max(20, Math.log(count) * 8),
          },
        });
      },
    },
  });
  //変更＋追加
  markerCluster.addListener("click", (event) => {
    if (infoWindow) infoWindow.close();
    const markersInCluster = event.markers;
    if (!markersInCluster || markersInCluster.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    markersInCluster.forEach(m => bounds.extend(m.getPosition()));

    // クラスタに合わせてズーム
    map.fitBounds(bounds);

    // updateCluster() が走ってズームが浅くなる対策で +1 補正
    google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() < 19) {
        map.setZoom(map.getZoom() + 1);
      }
    });
    setTimeout(() => updateCluster(), 100);
  });

  const updateCluster = _.debounce(() => {
    if (!map || !map.getBounds()) return;
    if (infoWindow.getMap()) return;
    //変更と追加
    markerCluster.clearMarkers();
    markerCluster.addMarkers(markers);
  }, 200);

  google.maps.event.clearListeners(map, "dragend");
  google.maps.event.clearListeners(map, "zoom_changed");
  map.addListener("dragend", updateCluster);
  map.addListener("zoom_changed", updateCluster);
  updateCluster();
}


async function updateNavMenu() {
  try {
    user = await getCurrentUser();
    if (!user) {
      navLoginBtn.textContent = "ログイン";
      navLoginBtn.onclick = () => (window.location.href = "auth.html");
      return;
    }
    navLoginBtn.textContent = "一覧";
    navLoginBtn.onclick = () => (window.location.href = "dashboard.html");
  } catch (error) {
    console.error("ログイン確認エラー:", error);
    navLoginBtn.textContent = "ログイン";
    navLoginBtn.onclick = () => (window.location.href = "auth.html");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const drawer = document.getElementById("filterDrawer");
  const overlay = document.getElementById("filterOverlay");
  const openBtn = document.getElementById("nav-list");
  openBtn.addEventListener("click", () => {
    drawer.style.right = "0";
    overlay.style.display = "block";
  });

  function closeFilterDrawer() {
    drawer.style.right = "-300px";
    overlay.style.display = "none";
  }
  document.getElementById("closeFilterDrawer")
    .addEventListener("click", closeFilterDrawer);
  document.getElementById("applyFilterBtn")
    .addEventListener("click", () => {
      const checks = document.querySelectorAll(".filter-checkbox:checked");
      activeFilters = Array.from(checks).map(c => Number(c.value));
      closeFilterDrawer();
      loadPins();
    });
  overlay.addEventListener("click", () => {
    closeFilterDrawer();
  });
  let isFilterOpen = false;
  document.getElementById("closeFilterDrawer").addEventListener("click", () => {
    drawer.style.right = "-300px";
    isFilterOpen = false;
  });
});

function getTokens() {
  access_token = localStorage.getItem("access_token");
  refresh_token = localStorage.getItem("refresh_token");
}
