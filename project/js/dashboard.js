import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dHpoc3ZjeXRxdXpoemR1dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTczMzEsImV4cCI6MjA3NjM5MzMzMX0.TnqtjeGLezpoPKNuc1q5ooIMiwneZjrEf4j0j5z3a4c"; // anonキー
const supabase = createClient(supabaseUrl, supabaseKey);

async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;
  return session.user;
}

async function init() {
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    alert("ログインが必要です。");
    window.location.href = "auth.html";
    return;
  }

  const role = user.user_metadata?.role || "user";

  const content = document.getElementById("content");
  if (role === "admin") {
    content.innerHTML = `<h2>管理者ページ</h2><p>すべての投稿を管理できます。</p>`;
  } else {
    content.innerHTML = `<h2>一般ユーザー</h2><p>自分の投稿だけ管理できます。</p>`;    
  }
    // ← ここで自分の投稿を読み込む
  await loadDashboardPins();
}

document.getElementById("map").addEventListener('click',function(){
  window.location.href= "index.html";
});
document.getElementById("logout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "auth.html";
});

async function loadDashboardPins() {
  const user = await getCurrentUser();
  if (!user) {
    alert("ログインしてください");
    window.location.href = "auth.html";
    return;
  }

  const { data: pins, error } = await supabase
    .from('hazard_pin')
    .select('*, categories(name)')
    .eq('uid', user.id);

    console.log(pins,error);
  if (error) {
    console.error("投稿取得エラー:", error);
    return;
  }

  const container = document.getElementById("content");
  container.innerHTML = "";

  pins.forEach(pin => {
    const card = document.createElement("div");
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

    const deleteBtn = card.querySelector("button");
    deleteBtn.addEventListener("click", async () => {
      // Storage 削除
      if (pin.image_path) {
        const filePath = pin.image_path.split('/').slice(-2).join('/');
        const { error: storageError } = await supabase.storage.from('pin-images').remove([filePath]);
        if (storageError) console.error("画像削除失敗:", storageError);
      }

      // テーブル削除
      const { error } = await supabase.from('hazard_pin').delete().eq('id', pin.id);
      if (error) {
        alert("削除できませんでした");
      } else {
        alert("削除しました");
        card.remove();
      }
    });

    container.appendChild(card);
  });
}

init();
