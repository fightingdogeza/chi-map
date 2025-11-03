import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Supabase クライアント ---
const supabaseUrl = "https://xztzhsvcytquzhzduura.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dHpoc3ZjeXRxdXpoemR1dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTczMzEsImV4cCI6MjA3NjM5MzMzMX0.TnqtjeGLezpoPKNuc1q5ooIMiwneZjrEf4j0j5z3a4c"; // anonキー
const supabase = createClient(supabaseUrl, supabaseKey);

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

// --- 新規登録（一般ユーザー固定、自動ログイン） ---
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  try {
    // 新規登録
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "user" } },
    });
    if (signupError) throw signupError;

    // 登録成功 → 自動ログイン
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;

    console.log("登録＆ログイン成功:", loginData.user);
    alert("登録とログインが成功しました！");

    // ログイン後にダッシュボードへ遷移
    window.location.href = "dashboard.html";

  } catch (err) {
    alert("エラー: " + err.message);
  }

  button.disabled = false;
});

// --- 管理者作成（Edge Function 経由） ---
export async function createAdmin(email, password, secretKey) {
  try {
    const res = await fetch("https://YOUR_PROJECT.functions.supabase.co/adminSignup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, secretKey })
    });
    const data = await res.json();
    if (data.error) {
      alert("管理者作成エラー: " + data.error);
    } else {
      alert("管理者作成成功！");
      console.log(data.user);
    }
  } catch (err) {
    alert("管理者作成失敗: " + err.message);
  }
}

// --- ログイン ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    console.log("ログイン成功:", data.user);
    window.location.href = "dashboard.html"; // ログイン後に移動
  } catch (err) {
    alert("ログインエラー: " + err.message);
  }
});

mapToBtn.addEventListener("click",function(){
      window.location.href = "index.html";
});