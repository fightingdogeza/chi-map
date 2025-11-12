let supabase = null;

async function initSupabase() {
  // Supabaseライブラリをグローバルから参照
  if (typeof window.supabase === 'undefined') {
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

// --- DOM要素取得 ---
const showSignupBtn = document.getElementById("show-signup-btn");
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const backToLoginBtn = document.getElementById("back-to-login-btn");
const mapToBtn = document.getElementById("map");
const forgotLink = document.getElementById("show-forgot-form");
const forgotForm = document.getElementById("forgot-form");
const backToLogin = document.getElementById("back-to-login");

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

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;

  const email = await document.getElementById("signup-email").value;
  const password = await document.getElementById("signup-password").value;

  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");
    alert("確認メールを送信しました。");

    const messageEl = document.getElementById("signup-message");
    if (messageEl) {
      messageEl.textContent = "メールを確認してください。アカウントはまだ有効化されていません。";
      messageEl.style.display = "block";
      signupForm.style.display = "none";
      loginForm.style.display = "none";
      document.getElementById("show-signup-btn").style.display = "none";
      document.getElementById("map").style.display = "none";
      document.getElementById("title").style.display = "none";
    }
  } catch (err) {
    alert("エラー: " + err.message);
  } finally {
    button.disabled = false;
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = await document.getElementById("login-email").value;
  const password = await document.getElementById("login-password").value;
  try {
    const res = await fetch("https://delete-pin-worker.chi-map.workers.dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ログインに失敗しました");
    localStorage.setItem("access_token", data.session.access_token);
    localStorage.setItem("refresh_token", data.session.refresh_token);
    window.location.href = "dashboard.html";
  } catch (err) {
    alert("ログインエラー: " + err.message);
  }
});


// --- 地図へ戻るボタン ---
mapToBtn.addEventListener("click", function () {
  window.location.href = "index.html";
});


// forgotLink.addEventListener("click", (e) => {
//   e.preventDefault();
//   loginForm.style.display = "none";
//   forgotForm.style.display = "block";
// });

backToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  forgotForm.style.display = "none";
  loginForm.style.display = "block";
});
// forgotForm.addEventListener("submit", async (e) => {
//   e.preventDefault();
//   const email = document.getElementById("forgot-email").value;
//   const button = forgotForm.querySelector("button");
//   button.disabled = true;

//   try {
//     const { error } = await supabase.auth.resetPasswordForEmail(email, {
//       redirectTo: "http://webapp-bka.pages.dev/reset-confirm.html", // メール内リンク先
//     });
//     if (error) throw error;
//     alert("パスワードリセット用のメールを送信しました。受信ボックスを確認してください。");
//   } catch (err) {
//     alert("エラー: " + err.message);
//   } finally {
//     button.disabled = false;
//   }
// });
