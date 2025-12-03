const showSignupBtn = document.getElementById("show-signup-btn");
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const backToLoginBtn = document.getElementById("back-to-login-btn");
const mapToBtn = document.getElementById("map");
const backToLogin = document.getElementById("back-to-login");
const btns = document.querySelectorAll("button");
let activeFilters = [];

showSignupBtn.addEventListener("click", () => {
  loginForm.style.display = "none";
  showSignupBtn.style.display = "none";
  signupForm.style.display = "flex";
  document.getElementById("signup-email").value = null;
  document.getElementById("signup-password").value = null;
});

backToLoginBtn.addEventListener("click", () => {
  signupForm.style.display = "none";
  loginForm.style.display = "flex";
  showSignupBtn.style.display = "inline-block";
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  btns.forEach(btn => {
    btn.disabled = true;
  });

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    const res = await fetch("https://environment.chi-map.workers.dev/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");
    alert("確認メールを送信しました。");
    signupForm.style.display = "none";
    loginForm.style.display = "none";
    document.getElementById("show-signup-btn").style.display = "none";
    document.getElementById("map").style.display = "none";
    document.getElementById("title").style.display = "none";

    const messageEl = document.getElementById("signup-message");
    if (messageEl) {
      messageEl.textContent = "ご自身の登録されたメールを確認してください。アカウントはまだ有効化されていません。";
      messageEl.style.display = "block";
    }
  } catch (err) {
    alert("エラー: " + err.message);
  } finally {
    btns.forEach(btn => {
      btn.disabled = false;
    });
  }
});

//ログイン
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  btns.forEach(btn => {
    btn.disabled = true;
  });
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  try {
    const res = await fetch("https://environment.chi-map.workers.dev/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      window.location.href = "https://chi-map.pages.dev/dashboard";
    } else {
      alert("ログインエラー: " + data.message);
      throw new Error(data.error || "ログインに失敗しました");
    }
  } catch (err) {
    alert("ログインエラー: " + err.message);
  } finally {
    btns.forEach(btn => {
      btn.disabled = false;
    });
  }
});
mapToBtn.addEventListener("click", function () {
  window.location.href = "https://chi-map.pages.dev";
});
backToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  forgotForm.style.display = "none";
  loginForm.style.display = "block";
});

function handleAuthRedirect() {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.substring(1));

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_in = params.get("expires_in");

  if (access_token && refresh_token) {
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    localStorage.setItem("token_expiry", Date.now() + expires_in * 1000);
    history.replaceState(null, "", "/");
  }
}
window.addEventListener("DOMContentLoaded", () => {
  handleAuthRedirect();
});
