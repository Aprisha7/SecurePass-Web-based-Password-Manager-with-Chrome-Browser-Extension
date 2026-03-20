const API_BASE = "http://localhost:3000/api";

const form = document.getElementById("register-form");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("masterPassword");
const toggleBtn = document.getElementById("togglePassword");
const strengthText = document.getElementById("strength-text");
const messageEl = document.getElementById("message");

// Toggle password visibility
toggleBtn.addEventListener("click", () => {
  const type = passInput.type === "password" ? "text" : "password";
  passInput.type = type;
});

// Password Strength Analysis 
passInput.addEventListener("input", () => {
  const val = passInput.value;
  let label = "Weak";
  let cls = "strength-weak";

  if (
    val.length >= 12 &&
    /[A-Z]/.test(val) &&
    /[0-9]/.test(val) &&
    /[^A-Za-z0-9]/.test(val)
  ) {
    label = "Strong";
    cls = "strength-strong";
  } else if (val.length >= 8) {
    label = "Medium";
    cls = "strength-medium";
  }

  if (!val) {
    label = "–";
    cls = "strength-none";
  }

  strengthText.textContent = label;
  strengthText.className = `strength-text ${cls}`;
});

// Call backend /api/auth/register
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.textContent = "";
  messageEl.classList.remove("success");

  const email = emailInput.value.trim();
  const masterPassword = passInput.value;

  if (!email || !masterPassword) {
    messageEl.textContent = "Email and master password are required.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, masterPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.error || "Registration failed.";
      return;
    }

    messageEl.textContent = data.message || "Registered successfully.";
    messageEl.classList.add("success");
    form.reset();
    setTimeout(() => {
    window.location.href = "login.html";
  }, 2000);
    strengthText.textContent = "–";
    strengthText.className = "strength-text strength-none";
  } catch {
    messageEl.textContent = "Network error. Please try again.";
  }
});
