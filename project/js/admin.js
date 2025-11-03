async function createAdmin(email, password, secretKey) {
  try {
    const res = await fetch("https://YOUR_PROJECT.functions.supabase.co/adminSignup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, secretKey }),
    });
    const data = await res.json();
    if (data.error) alert("管理者作成エラー: " + data.error);
    else alert("管理者作成成功！");
  } catch (err) {
    alert("管理者作成失敗: " + err.message);
  }
}

document.getElementById("admin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;

  const email = document.getElementById("admin-email").value;
  const password = document.getElementById("admin-password").value;
  const secretKey = document.getElementById("admin-key").value;

  await createAdmin(email, password, secretKey);

  button.disabled = false;
});
