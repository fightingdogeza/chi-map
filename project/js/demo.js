// Supabase 初期化
const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dHpoc3ZjeXRxdXpoemR1dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTczMzEsImV4cCI6MjA3NjM5MzMzMX0.TnqtjeGLezpoPKNuc1q5ooIMiwneZjrEf4j0j5z3a4c";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// グローバル変数
let map;               // Google Map
let tempMarker = null; // 仮ピン用
let modalOpen = false; // モーダル制御フラグ
let selectedLatLng = null; // ← 追加
let markers = [];       // マーカー管理用
let infoWindow = null;  // InfoWindow を一つだけ作る

// Google Map 初期化
window.initMap = function () {
  const initialLatLng = { lat: 35.6811673, lng: 139.7670516 }; // 東京駅

  map = new google.maps.Map(document.getElementById("map"), {
    center: initialLatLng,
    zoom: 15,
  });

  // ===== 地図クリックで仮ピンを設置 =====
  map.addListener("click", function (e) {
    if (modalOpen) return;
    // ここで選択座標を保存
    selectedLatLng = e.latLng;
    if (!document.getElementById("pinModal")) {
      loadModal().then(function () {
        openModal(); // ← modal.html読込が完了してから開く
      });
    } else {
      openModal();
    }
  });
  //GeolocationAPIで現在地のおおまかな位置を取得する
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
      enableHighAccuracy: false, // おおまかな位置
      timeout: 10000,
      maximumAge: 0,
    });
  } else {
    alert("このブラウザはGeolocation APIに対応していません。");
  }
  function successCallback(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const latlng = { lat, lng };

    console.log("現在地:", latlng);
    // 取得した位置をマップに反映
    map.setCenter(latlng);
  };

  function errorCallback(error) {
    console.warn("位置情報の取得に失敗しました:", error.message);
    output.textContent = "位置情報の取得に失敗しました。";
  }
  let geocoder = new google.maps.Geocoder();
  geocoder.geocode({ location: { lat: 35.6811673, lng: 139.7670516 } }, (results, status) => {
    if (status === "OK" && results[0]) {
      console.log(results[0].formatted_address);
    };
    //
    console.log(result);
  });
  //既存のピンを表示する
  loadPins();

  startRealtimeListener();
};

// modal.html を読み込んで body に追加
function loadModal() {
  return fetch("modal.html")
    .then(res => res.text())
    .then(html => {
      document.body.insertAdjacentHTML("beforeend", html);
      setupPost();
      // ここで確実に登録
      document.getElementById("cancelBtn").addEventListener("click", closeModal);
    })
    .catch(error => console.error("モーダルの読み込みに失敗:", error));
}
// モーダルを開く
function openModal() {
  modalOpen = true;
  const modal = document.getElementById("pinModal");
  modal.style.display = 'block';

  // キャンセルボタン
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
}

// モーダルを閉じる
function closeModal() {
  modalOpen = false;
  const modal = document.getElementById("pinModal");
  modal.style.display = "none";

  // 仮ピン削除
  if (tempMarker) {
    tempMarker.setMap(null);
    tempMarker = null;
  }
}
//setupPost()より前におく
async function loadPins() {
  const { data: pins, error } = await supabase
    .from('pin_table')
    .select(`*,
          categories!inner(name)`);

  if (error) {
    console.error('ピン取得エラー:', error);
    return;
  }

  // 既存マーカーを削除
  markers.forEach(m => m.setMap(null));
  markers = [];

  // InfoWindow は1つだけ作成
  if (!infoWindow) infoWindow = new google.maps.InfoWindow();
  //ピンの内部情報を格納しておく。
  pins.forEach(pin => {
    const marker = new google.maps.Marker({
      position: { lat: pin.lat, lng: pin.lng },
      map: map,
      title: pin.title
    });

    // マーカークリック時の処理
    marker.addListener("click", () => {
      const categoryName = pin.categories?.name ?? "未分類"; // null対応

      const content = `
      <div>
        <h3>${pin.title}</h3>
        <p>${pin.description}</p>
        <p><strong>カテゴリー:</strong> ${categoryName}</p>
        <p><strong>投稿日時:</strong> ${new Date(pin.created_at).toLocaleString()}</p>
      </div>
    `;

      infoWindow.setContent(content);
      infoWindow.open(map, marker);
    });
    markers.push(marker);
  });
}

// 送信ボタンが押されたときの処理
function setupPost() {
  const form = document.getElementById("pinForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    //仮ピンがない状態で送信フォームが開けた場合のエラー対策
    if (!tempMarker) {
      alert("地図をクリックして位置を選択してください。");
      return;
    }

    // 入力値取得
    const title = document.getElementById("title").value;
    const category_id = document.getElementById("category").value;
    const description = document.getElementById("description").value;
    // Supabase に INSERT
    const { data, error } = await supabase
      .from('pin_table')
      .insert([{
        title,
        description,
        category_id,
        created_at: new Date().toISOString(),
        lat: selectedLatLng.lat(),
        lng: selectedLatLng.lng()
      }]).select();
    //現段階ではerrorがnullであれば登録完了している
    console.log("insert result:", { data, error }); // ← data も一緒に受け取る

    if (error) {
      alert("投稿に失敗しました。");
      return;
    }

    alert("投稿が完了しました！");
    //モーダルを閉じる
    closeModal();
    //読込みが終わるまでloadPins()を呼び出さないようにする
    await loadPins();
  });
}

// リアルタイム監視
function startRealtimeListener() {
  supabase
    .channel('pin_table_changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pin_table' },
      payload => {
        console.log("新しいピンが追加されました", payload.new);
        const pin = payload.new;
        new google.maps.Marker({
          position: { lat: pin.lat, lng: pin.lng },
          map: map,
          icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          title: pin.title
        });
      }
    )
    .subscribe();
};
