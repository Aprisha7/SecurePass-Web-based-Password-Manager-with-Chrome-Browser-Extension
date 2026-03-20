const API_BASE = "http://localhost:3000/api";

const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("email");
const loginPassInput = document.getElementById("masterPassword");
const loginToggleBtn = document.getElementById("togglePassword");
const loginMessageEl = document.getElementById("message");
const loginBtn = document.querySelector(".primary-btn");
const twofaSection = document.getElementById('twofa-section');
const twofaCode = document.getElementById('twofa-code');
const useBackupLink = document.getElementById('use-backup-code');
let isBackupCode = false;
let pendingEmail = null;


function showMessage(text, type = 'success') {
  if (!loginMessageEl) return;
  loginMessageEl.textContent = text;
  loginMessageEl.className = `message ${type}`;
  loginMessageEl.classList.remove("hidden");
  
  setTimeout(() => {
    loginMessageEl.classList.add("hidden");
  }, 3000);
}

// Toggle password visibility
if (loginToggleBtn) {
  loginToggleBtn.addEventListener("click", () => {
    const type = loginPassInput.type === "password" ? "text" : "password";
    loginPassInput.type = type;
  });
}

// Login using backend API
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmailInput.value.trim();
  const masterPassword = loginPassInput.value;

  if (!email || !masterPassword) {
    showMessage("Email and master password are required.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, masterPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Login failed.", "error");
      return;
    }

    // CHECK IF 2FA IS REQUIRED
    if (data.requiresTwoFactor) {
      pendingEmail = email;
      showTwoFactorPrompt();
      return;
    }

    // Save token + user for later API calls
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    showMessage("Login successful!", "success");

    setTimeout(() => {
      window.location.href = "vault.html";
    }, 1000);
    
  } catch (error) {
    console.error("Login error:", error);
    showMessage("Server offline. Is backend running?", "error");
  }
});

// Show 2FA prompt
function showTwoFactorPrompt() {
  if (!twofaSection || !loginPassInput || !loginEmailInput || !loginBtn) return;
  twofaSection.style.display = 'block';
  loginPassInput.disabled = true;
  loginEmailInput.disabled = true;
  loginBtn.textContent = 'Verify 2FA';
}

// Handle 2FA verification
async function verifyTwoFactor() {
  if (!twofaCode || !pendingEmail || !loginPassInput) {
    showMessage("2FA information missing", "error");
    return;
  }
  
  const code = twofaCode.value.trim().toUpperCase();
  
  if (!code) {
    showMessage("Please enter verification code", "error");
    return;
  }
  
  // Validate based on mode
  if (isBackupCode) {
    // Validate backup code format (XXXX-XXXX)
    const backupCodePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!backupCodePattern.test(code)) {
      showMessage("Please enter a valid backup code (format: XXXX-XXXX)", "error");
      return;
    }
  } else {
    // Validate TOTP format (6 digits)
    const totpPattern = /^\d{6}$/;
    if (!totpPattern.test(code)) {
      showMessage("Please enter a valid 6-digit code", "error");
      return;
    }
  
    if (code.length !== 6) {
      showMessage("TOTP code must be exactly 6 digits", "error");
      return;
    }
  }

  try {
    console.log("Sending 2FA verification request:", {
      email: pendingEmail,
      token: code,
      isBackupCode: isBackupCode
    });

    
    const response = await fetch(`${API_BASE}/2fa/verify-login`, {  
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email: pendingEmail, 
        masterPassword: loginPassInput.value,  
        token: code,
        isBackupCode: isBackupCode 
      }),
    });

    console.log("Response status:", response.status);
    const data = await response.json();

    console.log("Response data:", data);


    if (!response.ok) {
      showMessage(data.error || "Verification failed", "error");
      return;
    }
    
    // Clear any old data first
    localStorage.clear();
    
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    
    console.log("New token stored:", data.token);
    
    window.location.href = "vault.html?t=" + Date.now();
    
  } catch (error) {
    console.error("2FA error:", error);
    showMessage("Verification error", "error");
  }
}

// Toggle between TOTP and backup code
if (useBackupLink && twofaCode) {
  useBackupLink.addEventListener('click', (e) => {
    e.preventDefault();
    isBackupCode = !isBackupCode;

    if (isBackupCode) {
      // Backup code mode
      twofaCode.placeholder = 'Enter backup code (e.g., XXXX-XXXX)';
      twofaCode.maxLength = '9';
      twofaCode.pattern = '[A-Z0-9-]{9}';
      useBackupLink.textContent = 'Use authenticator app instead';
    } else {
      // TOTP mode
      twofaCode.placeholder = 'Enter 6-digit code';
      twofaCode.maxLength = '6';
      twofaCode.pattern = '[0-9]{6}';
      useBackupLink.textContent = 'Use backup code instead';
    }
    
    // Clear any previous value
    twofaCode.value = '';
  });
}

if (loginBtn) {
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (twofaSection && twofaSection.style.display === 'block') {
      verifyTwoFactor();
    } else {
      // Otherwise trigger form submission
      loginForm.dispatchEvent(new Event('submit'));
    }
  });
}