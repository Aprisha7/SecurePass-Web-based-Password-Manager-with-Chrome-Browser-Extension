const API_BASE = "http://localhost:3000/api";

// Common elements
const vaultMessageEl = document.getElementById("vault-message");
const logoutBtn = document.getElementById("logout-btn");

// Navigation elements
const navLinks = document.querySelectorAll(".nav-link");
const pageSections = document.querySelectorAll(".page-section");

// Search elements
const searchInput = document.getElementById("password-search");
const clearSearchBtn = document.getElementById("clear-search");
let allPasswords = []; // Store full list

// Vault elements
const vaultBody = document.getElementById("vault-body");
const emptyState = document.getElementById("empty-state");
const showAddModalBtn = document.getElementById('show-add-modal');
const addModal = document.getElementById('add-password-modal');
const closeAddModalBtn = document.getElementById('close-add-modal');
const cancelAddBtn = document.getElementById('cancel-add');
const addPasswordForm = document.getElementById('add-password-form');
const modalWebsite = document.getElementById('modal-website');
const modalUsername = document.getElementById('modal-username');
const modalPassword = document.getElementById('modal-password');
const toggleModalPassword = document.getElementById('toggle-modal-password');

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editIdInput = document.getElementById("edit-id");
const editWebsiteInput = document.getElementById("edit-website");
const editUsernameInput = document.getElementById("edit-username");
const editPasswordInput = document.getElementById("edit-password");
const toggleEditPasswordBtn = document.getElementById("toggle-edit-password");
const closeModalBtn = document.getElementById("close-modal");
const cancelEditBtn = document.getElementById("cancel-edit");

// Admin elements
const adminNavItem = document.getElementById('admin-nav-item');

// Generator elements
const genLength = document.getElementById("gen-length");
const genLengthValue = document.getElementById("gen-length-value");
const genNumbers = document.getElementById("gen-numbers");
const genSymbols = document.getElementById("gen-symbols");
const generateBtn = document.getElementById("generate-btn");
const genPasswordInput = document.getElementById("gen-password");
const copyGenBtn = document.getElementById("copy-gen-btn");

// Analyzer elements
const strengthPassword = document.getElementById("strength-password");
const toggleStrength = document.getElementById("toggle-strength");
const meterFill = document.getElementById("meter-fill");
const strengthLabel = document.getElementById("strength-label");
const rules = document.querySelectorAll(".rule");

let lastAuthTime = 0;
const AUTH_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper to get token
function getToken() {
  return localStorage.getItem("token");
}

// Helper to get user info
function getUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

// Helper to show messages
function showMessage(text, type = 'success') {
  if (!vaultMessageEl) return;
  vaultMessageEl.textContent = text;
  vaultMessageEl.className = `message ${type}`;
  vaultMessageEl.classList.remove("hidden");
  
  setTimeout(() => {
    vaultMessageEl.classList.add("hidden");
  }, 3000);
}

// MASTER PASSWORD RE-AUTHENTICATION 
async function verifyMasterPassword() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // Create auth modal
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 12px;
      width: 350px;
      max-width: 90%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    
    modal.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="icon.png" alt="SecurePass" style="width: 60px; height: 60px; border-radius: 50%;">
        <h3 style="margin: 15px 0 5px; color: #1f2937;">Verify Master Password</h3>
        <p style="color: #6b7280; font-size: 13px;">Enter your master password to continue</p>
      </div>
      <div style="margin-bottom: 20px;">
        <input type="password" id="reauth-password" placeholder="Enter master password" style="
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        ">
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="reauth-cancel" style="
          flex: 1;
          padding: 12px;
          background: #f3f4f6;
          color: #4b5563;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        ">Cancel</button>
        <button id="reauth-verify" style="
          flex: 1;
          padding: 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        ">Verify</button>
      </div>
      <div id="reauth-error" style="color: #ef4444; font-size: 12px; margin-top: 10px; text-align: center; display: none;"></div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const passwordInput = document.getElementById('reauth-password');
    const verifyBtn = document.getElementById('reauth-verify');
    const cancelBtn = document.getElementById('reauth-cancel');
    const errorEl = document.getElementById('reauth-error');
    
    passwordInput.focus();
    
    // Function to verify with backend
    async function verify() {
      const masterPassword = passwordInput.value.trim();
      
      if (!masterPassword) {
        errorEl.textContent = 'Please enter your master password';
        errorEl.style.display = 'block';
        return;
      }
      
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
      
      try {
        const token = getToken();
        const user = getUser();
        
        if (!token || !user) {
          window.location.href = 'login.html';
          return;
        }
        
        // Verify master password with backend
        const response = await fetch(`${API_BASE}/auth/verify-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            email: user.email, 
            masterPassword: masterPassword 
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.valid) {
          // Update last auth time
          lastAuthTime = Date.now();
          document.body.removeChild(overlay);
          resolve(true);
          return;
        } else {
          errorEl.textContent = 'Incorrect master password';
          errorEl.style.display = 'block';
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'Verify';
          passwordInput.value = '';
          passwordInput.focus();
          resolve(false);
        }
      } catch (error) {
        console.error('Verification error:', error);
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify';
        resolve(false);
      }
    }
    
    // Event listeners
    verifyBtn.addEventListener('click', verify);
    
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });
    
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verify();
      }
    });
  });
}

// Check if authentication is needed
async function requireAuth(callback) {
  const timeSinceLastAuth = Date.now() - lastAuthTime;
  
  if (timeSinceLastAuth > AUTH_TIMEOUT || lastAuthTime === 0) {
    
    const verified = await verifyMasterPassword();
    
    if (verified) {
      lastAuthTime = Date.now();
      // Execute the callback after successful verification
      if (typeof callback === 'function') {
        await callback();
      }
      return true;
    }
    return false;
  } else {
    
    if (typeof callback === 'function') {
      await callback();
    }
    return true;
  }
}

// real-time URL validation
if (modalWebsite) {
  modalWebsite.addEventListener('input', function() {
    validateWebsiteField(this);
  });
  
  modalWebsite.addEventListener('blur', function() {
    validateWebsiteField(this);
  });
}

function validateWebsiteField(field) {
  const value = field.value.trim();
  
  // Create or get validation message element
  let validationMsg = document.getElementById('website-validation');
  if (!validationMsg) {
    validationMsg = document.createElement('div');
    validationMsg.id = 'website-validation';
    validationMsg.style.cssText = `
      font-size: 12px;
      margin-top: 4px;
      padding-left: 4px;
      display: none;
    `;
    field.parentNode.appendChild(validationMsg);
  }
  
  // Reset styles
  validationMsg.style.display = 'none';
  field.style.borderColor = '#e5e7eb';
  
  if (!value) return; 
  
  const urlPattern = /^https?:\/\/.+/i;
  const hasHttp = value.toLowerCase().startsWith('http://') || value.toLowerCase().startsWith('https://');
  
  if (!hasHttp) {
    field.style.borderColor = '#ef4444';
    validationMsg.textContent = '❌ URL must start with http:// or https://';
    validationMsg.style.color = '#ef4444';
    validationMsg.style.display = 'block';
  } else if (!urlPattern.test(value)) {
    field.style.borderColor = '#ef4444';
    validationMsg.textContent = '❌ Please enter a valid URL (e.g., https://example.com)';
    validationMsg.style.color = '#ef4444';
    validationMsg.style.display = 'block';
  } 
}

// real-time URL validation for edit modal
if (editWebsiteInput) {
  editWebsiteInput.addEventListener('input', function() {
    validateEditWebsiteField(this);
  });
  
  editWebsiteInput.addEventListener('blur', function() {
    validateEditWebsiteField(this);
  });
}

function validateEditWebsiteField(field) {
  const value = field.value.trim();
  
  // Create or get validation message element for edit modal
  let editValidationMsg = document.getElementById('edit-website-validation');
  if (!editValidationMsg) {
    editValidationMsg = document.createElement('div');
    editValidationMsg.id = 'edit-website-validation';
    editValidationMsg.style.cssText = `
      font-size: 12px;
      margin-top: 4px;
      padding-left: 4px;
      display: none;
    `;
    field.parentNode.appendChild(editValidationMsg);
  }
  
  // Reset styles
  editValidationMsg.style.display = 'none';
  field.style.borderColor = '#e5e7eb';
  field.style.backgroundColor = '';
  
  if (!value) return;
  
  const urlPattern = /^https?:\/\/.+/i;
  const hasHttp = value.toLowerCase().startsWith('http://') || value.toLowerCase().startsWith('https://');
  
  if (!hasHttp) {
    field.style.borderColor = '#ef4444';
    field.style.backgroundColor = '#fef2f2';
    editValidationMsg.textContent = '❌ URL must start with http:// or https://';
    editValidationMsg.style.color = '#ef4444';
    editValidationMsg.style.display = 'block';
  } else if (!urlPattern.test(value)) {
    field.style.borderColor = '#ef4444';
    field.style.backgroundColor = '#fef2f2';
    editValidationMsg.textContent = '❌ Please enter a valid URL (e.g., https://example.com)';
    editValidationMsg.style.color = '#ef4444';
    editValidationMsg.style.display = 'block';
  } else {
    field.style.borderColor = '#e5e7eb';
    field.style.backgroundColor = '';
    editValidationMsg.style.display = 'none';
  }
}

// Client-side password generator
function generateSecurePassword(length, includeNumbers, includeSymbols) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = lowercase + uppercase;
  if (includeNumbers) charset += numbers;
  if (includeSymbols) charset += symbols;

  let password = '';
  
  // Ensure at least one character from each required type
  if (includeNumbers) password += numbers[Math.floor(Math.random() * numbers.length)];
  if (includeSymbols) password += symbols[Math.floor(Math.random() * symbols.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];

  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle password for better randomness
  password = password.split('').sort(() => Math.random() - 0.5).join('');
  return password.substring(0, length);
}

// Auth check
(function ensureAuth() {
  const token = getToken();
  const user = getUser();
  
  console.log('Token:', token);
  console.log('User:', user);
  
  if (!token || !user) {
    window.location.href = "login.html";
    return;
  }
  
  // Check admin status directly from localStorage
  checkAdminStatus();
})();

// Check if user is admin - USING LOCALSTORAGE
function checkAdminStatus() {
  // Get user from localStorage
  const user = getUser();
  console.log('User from localStorage:', user);
  
  // Find admin nav item
  const adminNavItem = document.getElementById('admin-nav-item');
  console.log('Admin nav item found:', adminNavItem);
  
  if (adminNavItem) {
    if (user && user.role === 'admin') {
      console.log('User is admin - showing admin link');
      adminNavItem.style.display = 'block';
    } else {
      console.log('User is not admin - hiding admin link');
      adminNavItem.style.display = 'none';
    }
  }
}

// Load 2FA status
async function load2FAStatus() {
  const statusContent = document.getElementById('2fa-status-content');
  const statusLoading = document.getElementById('2fa-status-loading');

  if (!statusContent || !statusLoading) {
    console.error("2FA status elements not found in DOM");
    return;
  }
  
  const token = getToken();
  
  if (!token) {
    window.location.href = "login.html";
    return;
  }
  
  try {
    console.log("Fetching 2FA status from:", `${API_BASE}/2fa/status`);
    const response = await fetch(`${API_BASE}/2fa/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("2FA status response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("2FA status data:", data);
    
    statusLoading.style.display = 'none';
    statusContent.style.display = 'block';
    
    if (data.enabled) {
      statusContent.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h2 style="color: #10b981; margin-bottom: 16px;">2FA is Enabled</h2>
          <p style="color: #64748b; margin-bottom: 24px;">Your account is protected with two-factor authentication.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px;"><strong>Recovery option:</strong> Backup codes saved during setup</p>
          </div>
          <button id="disable-2fa-btn" class="secondary-btn" style="background: #fee2e2; color: #ef4444; border: none; padding: 12px 24px;">
            Disable 2FA
          </button>
        </div>
      `;
      
      document.getElementById('disable-2fa-btn')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) {
          await disable2FA();
        }
      });
      
    } else {
      statusContent.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
          <h2 style="color: #64748b; margin-bottom: 16px;">2FA is Not Enabled</h2>
          <p style="color: #64748b; margin-bottom: 24px;">Add an extra layer of security to your account.</p>
          <a href="2fa-setup.html" class="primary-btn" style="display: inline-block; text-decoration: none; padding: 12px 24px;" target="_blank">
            Enable 2FA Now
          </a>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Error loading 2FA status:', error);
    statusLoading.style.display = 'none';
    statusContent.style.display = 'block';
    statusContent.innerHTML = `
      <div style="text-align: center; color: #ef4444;">
        <p>Failed to load 2FA status. Please try again.</p>
        <p style="font-size: 12px; margin-top: 10px;">Please make sure backend is running on port 3000</p>
        <button onclick="location.reload()" class="secondary-btn" style="margin-top: 15px;">Retry</button>
      </div>
    `;
  }
}

// Disable 2FA
async function disable2FA() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Prompt for verification code
  const verificationCode = prompt("Please enter your current 2FA code to disable:");
  
  if (!verificationCode) {
    return; 
  }

  try {
    const response = await fetch(`${API_BASE}/2fa/disable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ token: verificationCode })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to disable 2FA");
      return;
    }

    alert("2FA has been disabled successfully!");
    
    // Refresh the 2FA status display
    load2FAStatus();
    
  } catch (error) {
    console.error("Disable 2FA error:", error);
    alert("Network error while disabling 2FA");
  }
}

// Navigation
function switchPage(pageId) {
  pageSections.forEach(section => section.classList.remove("active"));
  navLinks.forEach(link => link.classList.remove("active"));
  
  document.getElementById(`${pageId}-section`).classList.add("active");
  const activeLink = document.querySelector(`[data-page="${pageId}"]`);
  if (activeLink) {
    activeLink.parentElement.classList.add("active");
  }
  
  if (pageId === "vault") {
    loadPasswords();
  } else if (pageId === "2fa") {
    load2FAStatus(); // Load 2FA status when visiting that page
  
  }
}

navLinks.forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    switchPage(link.dataset.page);
  });
});

// SEARCH FUNCTIONALITY 
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();
  
  if (!query) {
    renderVault(allPasswords, false);
    clearSearchBtn.style.display = "none";
    return;
  }
  
  clearSearchBtn.style.display = "block";
  
  const filtered = allPasswords.filter(item => 
    item.website?.toLowerCase().includes(query) ||
    item.username?.toLowerCase().includes(query)
  );
  
  renderVault(filtered, true);
}

function clearSearch() {
  searchInput.value = "";
  clearSearchBtn.style.display = "none";
  renderVault(allPasswords, false);
}

// Search event listeners
if (searchInput) searchInput.addEventListener("input", debounce(handleSearch, 300));
if (clearSearchBtn) clearSearchBtn.addEventListener("click", clearSearch);

async function loadPasswords() {
  vaultMessageEl.textContent = "";
  const token = getToken();
  console.log("Loading passwords with token:", token ? "Token exists" : "No token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/passwords`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      vaultMessageEl.textContent = "Failed to load passwords.";
      return;
    }

    const data = await res.json();
    allPasswords = data; // Store full list for search
    renderVault(data, false);
  } catch (err) {
    console.error("Load passwords error:", err);
    vaultMessageEl.textContent = "Network error while loading passwords.";
  }
}

function renderVault(items, isSearch = false) {
  vaultBody.innerHTML = "";

  if (!items || items.length === 0) {
    if (isSearch && searchInput && searchInput.value) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 40px; color: #6b7280; font-style: italic;">
          No passwords match "${searchInput.value}"
        </td>
      `;
      vaultBody.appendChild(tr);
    } else {
      emptyState.style.display = "block";
    }
    return;
  }

  emptyState.style.display = "none";

  items.forEach((item) => {
    const tr = document.createElement("tr");
    const createdDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "";
    tr.innerHTML = `
      <td>${item.website || ""}</td>
      <td>${item.username || ""}</td>
      <td class="password-cell">
        <span class="password-value">••••••••</span>
        <button class="action-btn copy">Copy</button>
        <button class="action-btn toggle">Show</button>
      </td>
      <td>${createdDate}</td>
      <td>
        <button class="action-btn edit" title="Edit">Edit</button>
        <button class="action-btn delete" title="Delete">Delete</button>
      </td>
    `;

    const passwordValueEl = tr.querySelector(".password-value");
    const copyBtn = tr.querySelector(".copy");
    const toggleBtn = tr.querySelector(".toggle");
    const editBtn = tr.querySelector(".edit");
    const deleteBtn = tr.querySelector(".delete");

    let isShown = false;
    let actualPassword = item.password;

    toggleBtn.addEventListener("click", async () => {
      await requireAuth(async () => {
        isShown = !isShown;
      if (isShown) {
        passwordValueEl.textContent = actualPassword || "";
        toggleBtn.textContent = "Hide";
      } else {
        passwordValueEl.textContent = "••••••••";
        toggleBtn.textContent = "Show";
      }
    });
  });

    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
  
      // Wrap in authentication check
      await requireAuth(async () => {
      try {
        await navigator.clipboard.writeText(actualPassword || "");
        vaultMessageEl.textContent = "Password copied to clipboard.";
        vaultMessageEl.classList.add("success");
        setTimeout(() => {
          vaultMessageEl.textContent = "";
          vaultMessageEl.classList.remove("success");
        }, 1500);
      } catch {
        vaultMessageEl.textContent = "Failed to copy password.";
      }
    });
  });

    editBtn.addEventListener("click", () => {
    populateEditForm(item);
    editModal.style.display = "flex";
    });
    deleteBtn.addEventListener("click", () => handleDelete(item.id || item._id));
    vaultBody.appendChild(tr);
  });
}

// VAULT FORM
// Show add password modal
function showAddModal() {
  addModal.style.display = 'flex';
  modalWebsite.focus();
}

// Hide add password modal
function hideAddModal() {
  addModal.style.display = 'none';
  addPasswordForm.reset();

  // Reset website field styling
  if (modalWebsite) {
    modalWebsite.style.borderColor = '#e5e7eb';
  }
  
  // Hide modal error if exists
  const modalError = document.getElementById('modal-error');
  if (modalError) {
    modalError.textContent = '';
    modalError.style.display = 'none';
  }
  
  // Hide validation message if exists
  const validationMsg = document.getElementById('website-validation');
  if (validationMsg) {
    validationMsg.style.display = 'none';
  }
}


// Toggle password visibility in modal
if (toggleModalPassword) {
  toggleModalPassword.addEventListener('click', () => {
    const type = modalPassword.type === 'password' ? 'text' : 'password';
    modalPassword.type = type;
    toggleModalPassword.textContent = type === 'password' ? '👁' : '👁';
  });
}

// Handle add password form submission
addPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const website = modalWebsite.value.trim();
  const username = modalUsername.value.trim();
  const password = modalPassword.value;
  
  // Create modal message if it doesn't exist
  let modalError = document.getElementById('modal-error');
  if (!modalError) {
    modalError = document.createElement('div');
    modalError.id = 'modal-error';
    modalError.style.cssText = `
      color: #ef4444;
      background: #fee2e2;
      padding: 10px;
      border-radius: 6px;
      margin: 10px 0 0 0;
      font-size: 13px;
      text-align: center;
      display: none;
    `;
    
    const passwordRow = document.querySelector('#add-password-form .password-row').parentNode;
    const formActions = document.querySelector('#add-password-form .form-actions');
    passwordRow.parentNode.insertBefore(modalError, formActions);
  }
  
  // Hide previous error
  modalError.style.display = 'none';
  
  // Validate URL
  const urlPattern = /^https?:\/\/.+/i;
const hasHttp = website.toLowerCase().startsWith('http://') || website.toLowerCase().startsWith('https://');

if (!hasHttp) {
  modalError.textContent = "❌ URL must start with http:// or https://";
  modalError.style.display = 'block';
  modalWebsite.focus();
  return;
}

if (!urlPattern.test(website)) {
  modalError.textContent = "❌ Please enter a valid URL (e.g., https://instagram.com)";
  modalError.style.display = 'block';
  modalWebsite.focus();
  return;
}
  
  if (!website || !username || !password) {
    modalError.textContent = "❌ All fields are required.";
    modalError.style.display = 'block';
    return;
  }
  
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/passwords/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ website, username, password }),
    });
    
    const data = await res.json();
    if (!res.ok) {
      modalError.textContent = `❌ ${data.error || "Failed to save password."}`;
      modalError.style.display = 'block';
      return;
    }
    
    // Success
    hideAddModal();
    vaultMessageEl.textContent = "Password saved successfully!";
    vaultMessageEl.classList.add("success");
    vaultMessageEl.classList.remove("hidden");
    await loadPasswords();
    
    setTimeout(() => {
      vaultMessageEl.textContent = "";
      vaultMessageEl.classList.remove("success");
      vaultMessageEl.classList.add("hidden");
    }, 3000);
    
  } catch (err) {
    modalError.textContent = "Network error while saving password.";
    modalError.style.display = 'block';
  }
});

// Event listeners for modal
showAddModalBtn.addEventListener('click', showAddModal);
closeAddModalBtn.addEventListener('click', hideAddModal);
cancelAddBtn.addEventListener('click', hideAddModal);

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === addModal) {
    hideAddModal();
  }
});

// Edit functions
function populateEditForm(item) {
  editIdInput.value = item.id || item._id;
  editWebsiteInput.value = item.website || "";
  editUsernameInput.value = item.username || "";
  editPasswordInput.value = item.password || "";

  // Reset validation styling
  if (editWebsiteInput) {
    editWebsiteInput.style.borderColor = '#e5e7eb';
    editWebsiteInput.style.backgroundColor = '';
  }

  // Hide validation message
  const editValidationMsg = document.getElementById('edit-website-validation');
  if (editValidationMsg) {
    editValidationMsg.style.display = 'none';
  }
  
  // Hide any error message
  const editError = document.getElementById('edit-error');
  if (editError) {
    editError.style.display = 'none';
  }
}


function closeEditModal() {
  editModal.style.display = "none";
  editForm.reset();
  

  if (editWebsiteInput) {
    editWebsiteInput.style.borderColor = '#e5e7eb';
    editWebsiteInput.style.backgroundColor = '';
  }
  
  // Hide validation message
  const editValidationMsg = document.getElementById('edit-website-validation');
  if (editValidationMsg) {
    editValidationMsg.style.display = 'none';
  }
  
  // Hide error message
  const editError = document.getElementById('edit-error');
  if (editError) {
    editError.style.display = 'none';
  }
}

// Edit form submission
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const id = editIdInput.value;
  const website = editWebsiteInput.value.trim();
  const username = editUsernameInput.value.trim();
  const password = editPasswordInput.value;
  
  // Create or get edit modal message element
  let editError = document.getElementById('edit-error');
  if (!editError) {
    editError = document.createElement('div');
    editError.id = 'edit-error';
    editError.style.cssText = `
      color: #ef4444;
      background: #fee2e2;
      padding: 10px;
      border-radius: 6px;
      margin: 10px 0 0 0;
      font-size: 13px;
      text-align: center;
      display: none;
    `;
  
    const formActions = document.querySelector('#edit-form .form-actions');
    formActions.parentNode.insertBefore(editError, formActions);
  }

  editError.style.display = 'none';

  // Validate URL with specific messages
  const urlPattern = /^https?:\/\/.+/i;
  const hasHttp = website.toLowerCase().startsWith('http://') || website.toLowerCase().startsWith('https://');

  if (!hasHttp) {
    editError.textContent = "❌ URL must start with http:// or https://";
    editError.style.display = 'block';
    editWebsiteInput.focus();
    return;
  }

  if (!urlPattern.test(website)) {
    editError.textContent = "❌ Please enter a valid URL (e.g., https://example.com)";
    editError.style.display = 'block';
    editWebsiteInput.focus();
    return;
  }
  
  if (!website || !username || !password) {
    editError.textContent = "❌ All fields are required.";
    editError.style.display = 'block';
    return;
  }

  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/passwords/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ website, username, password }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      editError.textContent = `❌ ${data.error || "Failed to update password."}`;
      editError.style.display = 'block';
      return;
    }
    
    // Success
    closeEditModal();
    vaultMessageEl.textContent = "✅ Password updated successfully!";
    vaultMessageEl.classList.add("success");
    vaultMessageEl.classList.remove("hidden");
    await loadPasswords();

    setTimeout(() => {
      vaultMessageEl.textContent = "";
      vaultMessageEl.classList.remove("success");
      vaultMessageEl.classList.add("hidden");
    }, 3000);
    
  } catch (err) {
    console.error("Update error:", err);
    editError.textContent = "❌ Network error while updating password.";
    editError.style.display = 'block';
  }
});

// Edit modal controls
toggleEditPasswordBtn?.addEventListener("click", () => {
  const type = editPasswordInput.type === "password" ? "text" : "password";
  editPasswordInput.type = type;
});

closeModalBtn?.addEventListener("click", closeEditModal);
cancelEditBtn?.addEventListener("click", closeEditModal);

// Close on outside click
editModal?.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});


async function handleDelete(id) {
  if (!confirm("Delete this password?")) return;
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/passwords/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      vaultMessageEl.textContent = data.error || "Failed to delete password.";
      return;
    }

    vaultMessageEl.textContent = "Password deleted.";
    vaultMessageEl.classList.add("success");
    await loadPasswords(); // Refreshes full list + search
  } catch (err) {
    vaultMessageEl.textContent = "Network error while deleting password.";
  }
}

// Password Generator 
genLength.addEventListener("input", () => {
  genLengthValue.textContent = genLength.value;
});

generateBtn.addEventListener("click", () => {
  const length = parseInt(genLength.value);
  const includeNumbers = genNumbers.checked;
  const includeSymbols = genSymbols.checked;

  const password = generateSecurePassword(length, includeNumbers, includeSymbols);
  
  genPasswordInput.value = password;
  genPasswordInput.classList.add("generated");
  copyGenBtn.disabled = false;
  copyGenBtn.textContent = "Copy";
  
  vaultMessageEl.textContent = "Password generated successfully!";
  vaultMessageEl.classList.add("success");
  setTimeout(() => {
    vaultMessageEl.textContent = "";
    vaultMessageEl.classList.remove("success");
  }, 2000);
});

copyGenBtn.addEventListener("click", async () => {
  if (genPasswordInput.value) {
    try {
      await navigator.clipboard.writeText(genPasswordInput.value);
      showCopyNotification("Password copied to clipboard!");
    } catch {
      showCopyNotification("Failed to copy password", 'error');
    }
  }
});

  function showCopyNotification(message, type = 'success') {
  
  const existingNotif = document.querySelector('.copy-notification');
  if (existingNotif) existingNotif.remove();
  
  const notification = document.createElement('div');
  notification.className = 'copy-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  
  if (!document.querySelector('#copy-animation-style')) {
    const style = document.createElement('style');
    style.id = 'copy-animation-style';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Remove after 2 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// GENERATE PASSWORD FOR MODAL 
function generateModalPassword() {
  const length = 16; // You can make this configurable
  const includeNumbers = true;
  const includeSymbols = true;
  
  const password = generateSecurePassword(length, includeNumbers, includeSymbols);
  
  // Fill the password field
  if (modalPassword) {
    modalPassword.value = password;
    
    // Show success indicator
    const generateBtn = document.getElementById('generate-password-btn');
    if (generateBtn) {
      const originalText = generateBtn.innerHTML;
      generateBtn.innerHTML = '✅';
      setTimeout(() => {
        generateBtn.innerHTML = '🔑';
      }, 1500);
    }
    
    // Show strength indicator
    const strength = checkPasswordStrength(password);
    showMessage(`Generated ${strength} password!`, 'success');
  }
}

// Optional: Add password strength check for generated password
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  const strengths = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  return strengths[score] || 'Unknown';
}

// Add event listener for generate button
const generatePasswordBtn = document.getElementById('generate-password-btn');
if (generatePasswordBtn) {
  generatePasswordBtn.addEventListener('click', generateModalPassword);
}

//  Password Strength Analyzer 
toggleStrength.addEventListener("click", () => {
  const type = strengthPassword.type === "password" ? "text" : "password";
  strengthPassword.type = type;
});

strengthPassword.addEventListener("input", analyzePassword);

function analyzePassword() {
  const password = strengthPassword.value;
  let score = 0;
  
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  meterFill.style.width = `${Math.min(score * 20, 100)}%`;
  meterFill.className = `meter-fill strength-${score}`;
  
  const labels = ["Too Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  strengthLabel.textContent = labels[score] || "Enter a password";
  
  rules[0].classList.toggle("met", password.length >= 12);
  rules[1].classList.toggle("met", /[A-Z]/.test(password));
  rules[2].classList.toggle("met", /[a-z]/.test(password));
  rules[3].classList.toggle("met", /\d/.test(password));
  rules[4].classList.toggle("met", /[^A-Za-z0-9]/.test(password));
}

// Logout
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
});

// Initial load
switchPage("vault");
