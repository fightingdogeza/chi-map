let supabase = null;
  // --- DOM要素取得 ---
  let showSignupBtn = null;
  let signupForm = null;
  let loginForm = null;
  let backToLoginBtn = null;
  let mapToBtn = null;


// --- Supabase 初期化 ---
async function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    alert("supabase-jsのCDNが読み込まれているか確認してください。");
    return;
  }

  const res = await fetch('https://delete-pin-worker.chi-map.workers.dev/init-supabase');
  const { supabaseUrl, supabaseAnonKey } = await res.json();

  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase URLまたはキーが取得できません。");

  supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

  // サインアップ確認メールからのリダイレクト時にトークンを復元
  restoreSessionFromHash();

  return supabase;
}
// --- URLハッシュからアクセストークン取得（サインアップ後リダイレクト用） ---
function restoreSessionFromHash() {
  const hash = window.location.hash.substring(1); // # を除去
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (access_token && refresh_token && supabase) {
    supabase.auth.setSession({ access_token, refresh_token })
      .then(() => console.log("ログイン状態を復元しました"));
  }
}

// --- サインアップ ---
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");

    alert("確認メールを送信しました。メール内リンクをクリックしてログインしてください。");
    signupForm.style.display = "none";
    loginForm.style.display = "flex";

  } catch (err) {
    alert("エラー: " + err.message);
  } finally {
    button.disabled = false;
  }
});

// --- ログイン ---
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

    // data.session が undefined の場合を考慮
    if (!data.session || !data.session.access_token) {
      throw new Error("ログインセッションを取得できませんでした。");
    }

    localStorage.setItem("access_token", data.session.access_token);
    localStorage.setItem("refresh_token", data.session.refresh_token);

    window.location.href = "dashboard.html";
  } catch (err) {
    alert("ログインエラー: " + err.message);
  }
});



document.addEventListener("DOMContentLoaded", async () => {
  // --- DOM要素取得 ---
  showSignupBtn = document.getElementById("show-signup-btn");
  signupForm = document.getElementById("signup-form");
  loginForm = document.getElementById("login-form");
  backToLoginBtn = document.getElementById("back-to-login-btn");
  mapToBtn = document.getElementById("map");

  // --- イベント登録 ---
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

  mapToBtn.addEventListener("click", () => {
    window.location.href = "map.html";
  });

  // --- Supabase初期化 ---
  await waitForSupabase();
  initSupabase().catch(err => console.error(err));
});
