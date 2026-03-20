const API_BASE = 'http://localhost:3000/api';
const FRONTEND_BASE = "http://127.0.0.1:5501";

// State
let token = null;
let allPasswords = [];
let isUnlocked = false;
let vaultUnlocked = false;
let addOverlay = null;
let popupPendingEmail = null;
let popupIsBackupCode = false;
let pinEnabled = false;
let pinHash = null;
let activityTimeout = null;
let lastActivityTime = 0;
let activityCount = 0;

// DOM Elements
let loginScreen, vaultScreen, loginForm, loginEmail, loginPassword;
let toggleLoginPassword, logoutBtn, registerLink, searchInput, refreshBtn;
let vaultItems, emptyState, messageEl, generateBtn, fillBtn;

function sendUserActivity() {
  const now = Date.now();
  activityCount++;
  
  console.log(`Activity #${activityCount} at ${new Date().toLocaleTimeString()}`);
  console.log(`Time since last activity: ${(now - lastActivityTime)/1000} seconds`);
  lastActivityTime = now;

  if (activityTimeout) {
  console.log('Activity already scheduled, skipping');
   return; 
  }
  console.log('Scheduling userActivity in 10 seconds');
  activityTimeout = setTimeout(() => {
    console.log('SENDING userActivity now');
    chrome.runtime.sendMessage({ action: 'userActivity' });
    //console.log('Sending userActivity (debounced)');
    activityTimeout = null;
  }, 10000); // Send activity every 10 seconds max

}

document.addEventListener('click', sendUserActivity);
document.addEventListener('keypress', sendUserActivity);
document.addEventListener('mousemove', sendUserActivity);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  loginScreen = document.getElementById('login-screen');
  vaultScreen = document.getElementById('vault-screen');
  loginForm = document.getElementById('login-form');
  loginEmail = document.getElementById('login-email');
  loginPassword = document.getElementById('login-password');
  toggleLoginPassword = document.getElementById('toggle-login-password');
  logoutBtn = document.getElementById('logout-btn');
  registerLink = document.getElementById('register-link');
  searchInput = document.getElementById('search-input');
  refreshBtn = document.getElementById('refresh-btn');
  vaultItems = document.getElementById('vault-items');
  emptyState = document.getElementById('empty-state');
  messageEl = document.getElementById('message');
  generateBtn = document.getElementById('generate-btn');
  fillBtn = document.getElementById('fill-btn');
  

  // PIN setup button listeners
const pinSetupSave = document.getElementById('pin-setup-save');
const pinSetupSkip = document.getElementById('pin-setup-skip');

if (pinSetupSave) {
  pinSetupSave.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔵 Save PIN button clicked');
    setupPin();
  });
  console.log('✅ Save PIN listener attached');
}

if (pinSetupSkip) {
  pinSetupSkip.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('⏭️ Skip PIN button clicked');
    
    await chrome.storage.local.set({ 
      pinEnabled: false,
      pinHash: null 
    });
    
    pinEnabled = false;
    pinHash = null;
    vaultUnlocked = true;
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
  });
  console.log('Skip PIN listener attached');
}
  // Initialize PIN toggle after a short delay
  setTimeout(async () => {
    const { pinEnabled } = await chrome.storage.local.get('pinEnabled');
    const pinToggle = document.getElementById('pin-toggle');
    if (pinToggle) {
      pinToggle.checked = pinEnabled === true;
      
      pinToggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
          // User wants to enable PIN - show setup screen
          showPinSetupScreen();
        } else {
          // User wants to disable PIN
          if (confirm('Disable PIN unlock? You will need to enter your master password every time.')) {
            await chrome.storage.local.set({ 
              pinEnabled: false,
              pinHash: null 
            });
            pinEnabled = false;
            pinHash = null;
            console.log('🔓 PIN disabled');
          } else {
            // Revert toggle if user cancels
            e.target.checked = true;
          }
        }
      });
    }
  }, 500);

  // Initialize the popup
  initPopup();
});

async function initPopup() {
  console.log('🚀 Initializing popup...');
  console.log('logoutBtn exists:', !!logoutBtn);
  console.log('generateBtn exists:', !!generateBtn);
  console.log('fillBtn exists:', !!fillBtn);
  
   chrome.runtime.sendMessage({ action: 'userActivity' });

  // Check session first
  const session = await checkSession();
  console.log('Session:', session);
  
  if (!session || !session.sessionActive) {
    console.log('No active session - showing login');
    showLoginScreen();
    setupEventListeners(loginForm, registerLink, toggleLoginPassword, loginPassword, logoutBtn, searchInput, refreshBtn, generateBtn, fillBtn, loginEmail);
    createAddButton();
    return;
  }
  
  else if (session.vaultUnlocked) {
    console.log('Vault unlocked - showing vault');
    vaultUnlocked = true;
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
    // Reattach listeners after vault is loaded
    setTimeout(() => {
      reattachAllButtonListeners();
    }, 200);
  } else {
    console.log('Vault locked - checking PIN status');
    vaultUnlocked = false;
    checkPinStatus();
  }

}

// Check session on popup open
async function checkSession() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkSession' }, (response) => {
      resolve(response || { sessionActive: false, vaultUnlocked: false });
    });
  });
}

// Show login screen
function showLoginScreen() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  loginScreen.classList.add('active');
}

async function updatePinToggle() {
  const pinToggle = document.getElementById('pin-toggle');
  if (!pinToggle) return;
  
  const { pinEnabled } = await chrome.storage.local.get('pinEnabled');
  pinToggle.checked = pinEnabled === true;
}

// Show vault screen
function showVaultScreen() {
  console.log('📱 Showing vault screen');
  
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  vaultScreen.classList.add('active');
   
  reattachAllButtonListeners();
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    console.log('Search listener re-attached in showVaultScreen');
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('Refresh clicked');
      loadVault(vaultItems, emptyState);
    });
    console.log('Refresh listener re-attached in showVaultScreen');
  }
  updatePinToggle();
}

// Check if PIN is enabled
async function checkPinStatus() {
  const result = await chrome.storage.local.get(['pinEnabled', 'pinHash']);
  pinEnabled = result.pinEnabled || false;
  pinHash = result.pinHash || null;
  
  if (pinEnabled) {
    showPinUnlockScreen();
  } else {
    // No PIN set - show vault directly
    vaultUnlocked = true;
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
  }
}

// Show PIN unlock screen
function showPinUnlockScreen() {
  console.log('🔐 Showing PIN unlock screen');

  // Create PIN unlock screen if it doesn't exist
  if (!document.getElementById('pin-unlock-screen')) {
    console.log('Creating PIN unlock screen');
    createPinUnlockScreen();
  } else {
    
    console.log('Re-attaching PIN unlock listeners');
    const unlockBtn = document.getElementById('pin-unlock-btn');
    const unlockInput = document.getElementById('pin-unlock-input');
    const logoutBtn = document.getElementById('pin-unlock-logout');
    
    if (unlockBtn) {
      unlockBtn.replaceWith(unlockBtn.cloneNode(true));
      const newUnlockBtn = document.getElementById('pin-unlock-btn');
      newUnlockBtn.addEventListener('click', handlePinUnlock);
    }
    
    if (unlockInput) {
      unlockInput.replaceWith(unlockInput.cloneNode(true));
      const newUnlockInput = document.getElementById('pin-unlock-input');
      newUnlockInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePinUnlock();
      });
    }
    
    if (logoutBtn) {
      logoutBtn.replaceWith(logoutBtn.cloneNode(true));
      const newLogoutBtn = document.getElementById('pin-unlock-logout');
      newLogoutBtn.addEventListener('click', () => {
        chrome.storage.local.set({ sessionActive: false, vaultUnlocked: false });
        showLoginScreen();
      });
    }
  }
  
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('pin-unlock-screen').classList.add('active');
  setTimeout(() => document.getElementById('pin-unlock-input')?.focus(), 100);
}

// Create PIN unlock screen
function createPinUnlockScreen() {
  const screen = document.createElement('div');
  screen.id = 'pin-unlock-screen';
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="pin-container" style="padding: 30px; text-align: center;">
      <h2 style="margin-bottom: 20px;">Enter PIN</h2>
      <p style="color: #6b7280; margin-bottom: 20px;">Quick unlock your vault</p>
      
      <input type="password" id="pin-unlock-input" maxlength="6" 
             placeholder="Enter PIN" class="pin-input" 
             style="width: 100%; padding: 15px; font-size: 20px; letter-spacing: 4px; text-align: center; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; font-family: monospace;">
      
      <div id="pin-unlock-error" style="color: #ef4444; font-size: 12px; min-height: 20px; margin-bottom: 10px;"></div>
      
      <button id="pin-unlock-btn" class="primary-btn" style="width: 100%; margin-bottom: 10px;">Unlock</button>
      <button id="pin-unlock-logout" class="secondary-btn" style="width: 100%;">Use Master Password</button>
    </div>
  `;
  document.body.appendChild(screen);
  
  // Add event listeners
  document.getElementById('pin-unlock-btn').addEventListener('click', handlePinUnlock);
  document.getElementById('pin-unlock-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handlePinUnlock();
  });
  document.getElementById('pin-unlock-logout').addEventListener('click', () => {
    chrome.storage.local.set({ sessionActive: false, vaultUnlocked: false });
    showLoginScreen();
  });
}

// Handle PIN unlock
async function handlePinUnlock() {
  const pin = document.getElementById('pin-unlock-input').value;
  const errorEl = document.getElementById('pin-unlock-error');
  
  if (!pin || pin.length < 4) {
    errorEl.textContent = 'Please enter your PIN';
    return;
  }
  
  // Hash the entered PIN
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const enteredHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Get stored PIN hash
  const { pinHash } = await chrome.storage.local.get('pinHash');
  
  if (enteredHash === pinHash) {
    // Correct PIN - unlock vault
    chrome.runtime.sendMessage({ action: 'unlockVault' });
    chrome.runtime.sendMessage({ action: 'userActivity' });
    vaultUnlocked = true;
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
    reattachAllButtonListeners();
  } else {
    errorEl.textContent = 'Invalid PIN';
    document.getElementById('pin-unlock-input').value = '';
  }
}

// Show PIN setup screen
function showPinSetupScreen() {
  console.log('Showing PIN setup screen');
  
  // Clear any previous values
  const input = document.getElementById('pin-setup-input');
  const confirm = document.getElementById('pin-setup-confirm');
  const error = document.getElementById('pin-setup-error');
  
  if (input) input.value = '';
  if (confirm) confirm.value = '';
  if (error) error.textContent = '';
  
  // Show the screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('pin-setup-screen').classList.add('active');
  
  // Verify buttons exist
  setTimeout(() => {
    const saveBtn = document.getElementById('pin-setup-save');
    const skipBtn = document.getElementById('pin-setup-skip');
    console.log('Save button exists:', !!saveBtn);
    console.log('Skip button exists:', !!skipBtn);
  }, 100);
}

// Setup PIN
async function setupPin() {
  console.log('🔐 Setup PIN function called');
  
  const pin = document.getElementById('pin-setup-input').value;
  const confirm = document.getElementById('pin-setup-confirm').value;
  const errorEl = document.getElementById('pin-setup-error');
  
  if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    errorEl.textContent = 'PIN must be 4-6 digits';
    return;
  }
  
  if (pin !== confirm) {
    errorEl.textContent = 'PINs do not match';
    return;
  }

  try {
    // Hash PIN
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPin = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Store PIN
    await chrome.storage.local.set({ 
      pinEnabled: true,
      pinHash: hashedPin 
    });
    
    pinEnabled = true;
    pinHash = hashedPin;
    vaultUnlocked = true;
    
    console.log('PIN saved successfully');
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
    
  } catch (error) {
    console.error('Error setting up PIN:', error);
    if (errorEl) errorEl.textContent = 'Error saving PIN';
  }
}


async function loadVault(vaultItems, emptyState) {
   console.log('Loading vault...');
  console.log('vaultUnlocked:', vaultUnlocked);
  console.log('token:', token ? 'exists' : 'missing');
  console.log('isUnlocked:', isUnlocked);
  if (!vaultUnlocked) {
    console.log('🔒 Vault locked, showing PIN screen');
    showPinUnlockScreen();
    return;
  }
  
  if (!token || !isUnlocked) {
    console.log('Need to get token');
    // Need to get token first
    token = await getToken();
     console.log('Token after getToken:', token ? 'exists' : 'missing');
    if (!token) {
      console.log('No token, showing login');
      showLoginScreen();
      return;
    }
    isUnlocked = true;
  }
  
  try {
    console.log('Fetching passwords with token');
    const response = await fetch(`${API_BASE}/passwords`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      showMessage('Session expired. Please login again', 'error');
      handleLogout();
      return;
    }

    const data = await response.json();
    console.log(`Loaded ${data.length} passwords`);
    allPasswords = data;
    renderVault(vaultItems, emptyState, data);
    
  } catch (error) {
    console.error('Load vault error:', error);
    showMessage('Cannot connect to server', 'error');
  }
}

// Modify copyPassword to check unlock status
async function copyPassword(item) {
  if (!vaultUnlocked) {
    showPinUnlockScreen();
    return;
  }
  
  try {
    await navigator.clipboard.writeText(item.password);
    showMessage(`Copied ${item.website} password!`, 'success');
    setTimeout(() => window.close(), 1500);
  } catch (error) {
    showMessage('Failed to copy password', 'error');
  }
}

async function clearToken() {
  token = null;
  isUnlocked = false;
  localStorage.removeItem('token');
  await chrome.storage.local.remove('token');
}

function reattachAllButtonListeners() {
  console.log('Re-attaching all button listeners');
  
  const currentToken = token;
  const currentVaultUnlocked = vaultUnlocked;
  const currentIsUnlocked = isUnlocked;
  // Logout button
  if (logoutBtn) {
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    logoutBtn = newLogoutBtn;
    
    logoutBtn.addEventListener('click', () => {
      console.log('Logout clicked');
      handleLogout();
    });
  }
  
  // Generate button
  if (generateBtn) {
    const newGenerateBtn = generateBtn.cloneNode(true);
    generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);
    generateBtn = newGenerateBtn;
    
    generateBtn.addEventListener('click', () => {
      console.log('🔑 Generate clicked');
      generatePassword();
    });
  }
  
  // Fill button
  if (fillBtn) {
    const newFillBtn = fillBtn.cloneNode(true);
    fillBtn.parentNode.replaceChild(newFillBtn, fillBtn);
    fillBtn = newFillBtn;
    
    fillBtn.addEventListener('click', () => {
      console.log('Fill site clicked');
      fillCurrentSite();
    });
  }
  
  // Refresh button
  if (refreshBtn) {
    const newRefreshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
    refreshBtn = newRefreshBtn;
    
    refreshBtn.addEventListener('click', () => {
      console.log('Refresh clicked');
      loadVault(vaultItems, emptyState);
    });
  }
  
  if (searchInput) {
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    searchInput = newSearchInput;
    
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    console.log('Search listener re-attached');
  }

// Restore state
  token = currentToken;
  vaultUnlocked = currentVaultUnlocked;
  isUnlocked = currentIsUnlocked;
  
  let addBtn = document.getElementById('add-new-btn');
  if (!addBtn && isUnlocked) {
    console.log('➕ Add button missing, recreating...');
    createAddButton();
  } else if (addBtn) {
    addBtn.onclick = showAddForm;
    console.log('Add button verified');
  }

  console.log('All button listeners re-attached');
}

function setupEventListeners(loginForm, registerLink, toggleLoginPassword, loginPassword, logoutBtn, searchInput, refreshBtn, generateBtn, fillBtn, loginEmail) {
  // Password toggle
  toggleLoginPassword.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (loginPassword.type === 'password') {
      loginPassword.type = 'text';
      toggleLoginPassword.textContent = '👁';
    } else {
      loginPassword.type = 'password';
      toggleLoginPassword.textContent = '👁';
    }
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const twofaSection = document.getElementById('popup-twofa-section');
    
    if (twofaSection && twofaSection.style.display === 'block') {
      handlePopupTwoFactorVerify();
    } else {
      handleLogin(e, loginEmail, loginPassword);
    }
  });
  
  registerLink.addEventListener('click', (e) => {
    console.log('Register link clicked');
    showRegister(e);
  });
  
  logoutBtn.addEventListener('click', () => {
    console.log('Logout clicked');
    handleLogout();
  });
  
  searchInput.addEventListener('input', debounce(handleSearch, 300));
  
  refreshBtn.addEventListener('click', () => {
    console.log('Refresh clicked');
    loadVault(vaultItems, emptyState);
  });
  
  generateBtn.addEventListener('click', () => {
    console.log('🔑 Generate clicked');
    generatePassword();
  });
  
  fillBtn.addEventListener('click', () => {
    console.log('Fill site clicked');
    fillCurrentSite();
  });
}

function createAddButton() {
  // Check if button already exists
    if (document.getElementById('add-new-btn')) return;
  // Get the vault header
  const vaultHeader = document.querySelector('.vault-header');
  if (!vaultHeader) return;
  
  // Create add button
  const addBtn = document.createElement('button');
  addBtn.innerHTML = '➕';
  addBtn.id = 'add-new-btn';
  addBtn.title = 'Add new password';
  addBtn.onclick = showAddForm;
  
  // Insert add button next to the title
  const titleElement = vaultHeader.querySelector('h2');
  if (titleElement) {
    titleElement.appendChild(addBtn);
  } else {
    vaultHeader.insertBefore(addBtn, vaultHeader.firstChild);
  }
  
  // Hide if not unlocked
  if (!isUnlocked) addBtn.style.display = 'none';
  console.log('Add button created');
  
  createAddOverlay();
}

function createAddOverlay() {
  addOverlay = document.createElement('div');
  addOverlay.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 9999;
  `;
  
  addOverlay.innerHTML = `
    <div style="background: white; position: absolute; top: 50%; left: 50%; 
                transform: translate(-50%, -50%); padding: 24px; border-radius: 12px; 
                max-width: 320px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; font-size: 20px; font-weight: 600;">Add New Password</h3>
        <button id="close-add-overlay" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0;">×</button>
      </div>
      <input id="new-website" type="text" placeholder="https://www.example.com" style="width: 100%; padding: 14px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 14px;">
      <input id="new-username" type="text" placeholder="username@example.com" style="width: 100%; padding: 14px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 14px;">
      <div style="position: relative; margin-bottom: 16px;">
        <input id="new-password" type="password" placeholder="••••••••" style="width: 100%; padding: 14px 45px 14px 14px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 14px;">
        <button id="toggle-new-password" type="button" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 16px; cursor: pointer; color: #666;">👁</button>
      </div>
      <button id="save-new-password" style="width: 100%; padding: 14px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">Save Password</button>
    </div>
  `;
  
  document.body.appendChild(addOverlay);
  
  addOverlay.querySelector('#close-add-overlay').onclick = hideAddForm;
  addOverlay.querySelector('#toggle-new-password').onclick = function() {
    const pwd = document.getElementById('new-password');
    pwd.type = pwd.type === 'password' ? 'text' : 'password';
    this.textContent = pwd.type === 'password' ? '👁' : '👁';
  };
  addOverlay.querySelector('#save-new-password').onclick = saveNewPassword;
}

function showAddForm() {
  addOverlay.style.display = 'block';
  document.getElementById('new-website').focus();
}

function hideAddForm() {
  addOverlay.style.display = 'none';
  document.getElementById('new-website').value = '';
  document.getElementById('new-username').value = '';
  document.getElementById('new-password').value = '';
  setTimeout(() => {
    reattachAllButtonListeners();
  }, 100);
}

async function saveNewPassword() {
  const website = document.getElementById('new-website').value.trim();
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  
  if (!website || !username || !password) {
    showMessage('All fields are required', 'error');
    return;
  }
  
  if (!/^https?:\/\/.+/.test(website)) {
    showMessage('Full URL required (https://example.com)', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/passwords/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ website, username, password })
    });
    
    if (response.ok) {
      showMessage('Password saved successfully!', 'success');
      hideAddForm();
      loadVault(vaultItems, emptyState);
    } else {
      const data = await response.json();
      showMessage(data.error || 'Failed to save', 'error');
    }
  } catch (error) {
    showMessage('Network error', 'error');
  }
}

async function handleLogin(e, loginEmail, loginPassword) {
  e.preventDefault();
  
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  
  if (!email || !password) {
    showMessage('Please fill all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, masterPassword: password })
    });

    const data = await response.json();
    
    if (!response.ok) {
      showMessage(data.error || 'Login failed', 'error');
      return;
    }

    // CHECK IF 2FA IS REQUIRED
    if (data.requiresTwoFactor) {
      popupPendingEmail = email;
      showPopupTwoFactorPrompt();
      return;
    }
    
    // No 2FA - login directly
    token = data.token;
    await setToken(token);
    isUnlocked = true;
    vaultUnlocked = true;
    
    // Set session active
    await chrome.storage.local.set({ 
      sessionActive: true,
      vaultUnlocked: true 
    });
    
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
    reattachAllButtonListeners();
    showMessage('Welcome back!', 'success');
    
    // Ask to setup PIN
    setTimeout(async () => {
      const { pinEnabled } = await chrome.storage.local.get('pinEnabled');
      if (!pinEnabled && confirm('Set up PIN for quick unlock?')) {
        showPinSetupScreen();
      }
    }, 1000);
    
  } catch (error) {
    console.error('Login error:', error);
    showMessage('Server offline. Is backend running?', 'error');
  }
}

// Show 2FA prompt in popup
function showPopupTwoFactorPrompt() {
  const twofaSection = document.getElementById('popup-twofa-section');
  const loginBtn = document.querySelector('.primary-btn');
  
  if (twofaSection) {
    twofaSection.style.display = 'block';
  }
  
  // Disable email/password fields
  document.getElementById('login-email').disabled = true;
  document.getElementById('login-password').disabled = true;
  
  if (loginBtn) {
    loginBtn.textContent = 'Verify 2FA';
  }
}

// Handle 2FA verification in popup
async function handlePopupTwoFactorVerify() {
  const twofaCode = document.getElementById('popup-twofa-code');
  const code = twofaCode.value.trim().toUpperCase();
  
  if (!code) {
    showMessage('Please enter verification code', 'error');
    return;
  }
  
  // Validate based on mode
  if (popupIsBackupCode) {
    const backupCodePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!backupCodePattern.test(code)) {
      showMessage('Please enter a valid backup code (format: XXXX-XXXX)', 'error');
      return;
    }
  } else {
    const totpPattern = /^\d{6}$/;
    if (!totpPattern.test(code)) {
      showMessage('Please enter a valid 6-digit code', 'error');
      return;
    }
  }
  
  try {
    const response = await fetch(`${API_BASE}/auth/verify-2fa-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: popupPendingEmail, 
        masterPassword: document.getElementById('login-password').value,
        token: code,
        isBackupCode: popupIsBackupCode 
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Verification failed', 'error');
      return;
    }
    
    // Success - store token and show vault
    token = data.token;
    await setToken(token);
    isUnlocked = true;
    vaultUnlocked = true;
    
    // Set session active
    await chrome.storage.local.set({ 
      sessionActive: true,
      vaultUnlocked: true 
    });
    
    showVaultScreen();
    await loadVault(vaultItems, emptyState);
    showMessage('Login successful!', 'success');
    
  } catch (error) {
    console.error('2FA error:', error);
    showMessage('Verification error', 'error');
  }
}

// Toggle between TOTP and backup code in popup
const popupUseBackupLink = document.getElementById('popup-use-backup-code');
const popupTwofaCode = document.getElementById('popup-twofa-code');

if (popupUseBackupLink && popupTwofaCode) {
  popupUseBackupLink.addEventListener('click', (e) => {
    e.preventDefault();
    popupIsBackupCode = !popupIsBackupCode;
    
    if (popupIsBackupCode) {
      popupTwofaCode.placeholder = 'Enter backup code (XXXX-XXXX)';
      popupTwofaCode.maxLength = '9';
      popupUseBackupLink.textContent = 'Use authenticator app instead';
    } else {
      popupTwofaCode.placeholder = 'Enter 6-digit code';
      popupTwofaCode.maxLength = '6';
      popupUseBackupLink.textContent = 'Use backup code instead';
    }
    
    popupTwofaCode.value = '';
  });
}

function showRegister(e) {
  e.preventDefault();
  chrome.tabs.create({ 
    url: "C:/Users/ASUS/Desktop/FYP/frontend/login.html" 
  });
  window.close();
}

function showVault(loginScreen, vaultScreen) {
  loginScreen.classList.remove('active');
  vaultScreen.classList.add('active');
  const addBtn = document.getElementById('add-new-btn');
  const headerContainer = document.getElementById('header-actions');
  if (addBtn && headerContainer) {
    addBtn.style.display = 'flex';
    headerContainer.style.display = 'flex';
  }
}

function handleLogout() {
  token = null;
  isUnlocked = false;
  vaultUnlocked = false;
  
  // Clear from both storages
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  chrome.storage.local.remove('token');
  chrome.storage.local.set({ sessionActive: false, vaultUnlocked: false });
  
  loginScreen.classList.add('active');
  vaultScreen.classList.remove('active');
  vaultItems.innerHTML = '';
  loginEmail.value = '';
  loginPassword.value = '';
  emptyState.style.display = 'none';
  
  const addBtn = document.getElementById('add-new-btn');
  const headerContainer = document.getElementById('header-actions');
  if (addBtn) addBtn.style.display = 'none';
  if (headerContainer) headerContainer.style.display = 'none';
}

function renderVault(vaultItems, emptyState, items = []) {
  vaultItems.innerHTML = '';
  
  if (items.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'vault-item';
    div.innerHTML = `
      <div>
        <div class="vault-site">${item.website || 'Unknown'}</div>
        <div class="vault-username">${item.username || ''}</div>
      </div>
      <div class="vault-actions">
        <button class="icon-btn copy-btn" title="Copy Password">📋</button>
      </div>
    `;
    
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-btn')) return;
      copyPassword(item);
    });
    
    const copyBtn = div.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.style.cssText = `
        background: #dbeafe; color: #1e40af; border: 2px solid #bfdbfe;
        width: 36px; height: 36px; border-radius: 8px; font-size: 16px;
        margin-left: 8px; cursor: pointer; transition: all 0.2s ease;
      `;
      copyBtn.onmouseover = () => {
        copyBtn.style.background = '#bfdbfe';
        copyBtn.style.transform = 'scale(1.05)';
      };
      copyBtn.onmouseout = () => {
        copyBtn.style.background = '#dbeafe';
        copyBtn.style.transform = 'scale(1)';
      };
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyPassword(item);
      });
    }
    
    vaultItems.appendChild(div);
  });
}

function handleSearch() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  if (!query) {
    renderVault(vaultItems, emptyState, allPasswords);
    return;
  }
  
  const filtered = allPasswords.filter(item =>
    item.website?.toLowerCase().includes(query) ||
    item.username?.toLowerCase().includes(query)
  );
  
  renderVault(vaultItems, emptyState, filtered);
}

async function generatePassword() {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  let password = '';
  
  for (let i = 0; i < 16; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  await navigator.clipboard.writeText(password);
  showMessage('Generated password copied!', 'success');
  setTimeout(() => {
    reattachAllButtonListeners();
  }, 100);
  setTimeout(() => window.close(), 1000);
}

async function fillCurrentSite() {
  try {
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab[0].url).hostname.toLowerCase();
    
    const match = allPasswords.find(item => {
      const site = item.website?.toLowerCase().replace('www.', '');
      const domain = url.replace('www.', '');
      return site === domain || domain.includes(site) || site.includes(domain);
    });
    
    if (!match) {
      showMessage(`No password for ${url.replace('www.', '')}`, 'error');
      return;
    }
    
    chrome.tabs.sendMessage(tab[0].id, { 
      action: 'fillNow',
      credentials: match
    }, (response) => {
      if (response?.success) {
        showMessage(`Autofilled ${match.website}!`, 'success');
      } else {
        showMessage(`Ready for ${match.website}`, 'success');
      }
      setTimeout(() => {
        reattachAllButtonListeners();
      }, 100);
      window.close();
    });
    
  } catch (error) {
    console.error('Fill error:', error);
    showMessage('No active tab or extension error', 'error');
  }
}

function showMessage(text, type = 'success') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');
  
  setTimeout(() => {
    messageEl.classList.add('hidden');
  }, 3000);
}

async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token'], (result) => {
      if (result.token) {
        console.log('Token found in chrome.storage');
        resolve(result.token);
      } else {
        const localToken = localStorage.getItem('token');
        if (localToken) {
          console.log('Token found in localStorage, syncing to chrome.storage');
          chrome.storage.local.set({ token: localToken }, () => {
            resolve(localToken);
          });
        } else {
          console.log('No token found anywhere');
          resolve(null);
        }
      }
    });
  });
}

function getUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

async function setToken(token) {
  return new Promise((resolve) => {
    localStorage.setItem('token', token);
    chrome.storage.local.set({ token }, () => {
      console.log('Token saved to both localStorage and chrome.storage');
      resolve();
    });
  });
}

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