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
  console.log("Supabase initialized:", supabaseUrl);
  return supabase;
}

// --- DOM要素取得 ---
const showSignupBtn = document.getElementById("show-signup-btn");
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const backToLoginBtn = document.getElementById("back-to-login-btn");
const mapToBtn = document.getElementById("map");

// --- フォーム切替 ---
showSignupBtn.addEventListener("click", () => {
  loginForm.style.display = "none";
  showSignupBtn.style.display = "none";
  signupForm.style.display = "flex";
});

backToLoginBtn.addEventListener("click", () => {
  signupForm.style.display = "none";
  loginForm.style.display = "flex";
  showSignupBtn.style.display = "inline-block";
});

// ================== 新規登録（Workers経由） ==================
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");

    alert("登録に成功しました！");
    window.location.href = "dashboard.html";
  } catch (err) {
    alert("エラー: " + err.message);
  } finally {
    button.disabled = false;
  }
});

// ================== ログイン（Workers経由） ==================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ログインに失敗しました");

    console.log("ログイン成功:", data.user);
    window.location.href = "dashboard.html"; // ログイン後に移動
  } catch (err) {
    alert("ログインエラー: " + err.message);
  }
});

// --- 地図へ戻るボタン ---
mapToBtn.addEventListener("click", function() {
  window.location.href = "index.html";
});
