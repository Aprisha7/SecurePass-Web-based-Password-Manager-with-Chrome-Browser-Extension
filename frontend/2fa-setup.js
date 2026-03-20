const API_BASE = "http://localhost:3000/api";

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const qrCodeDiv = document.getElementById('qr-code');
const manualSecret = document.getElementById('manual-secret');
const verifyBtn = document.getElementById('verify-btn');
const verificationCode = document.getElementById('verification-code');
const step1Message = document.getElementById('step1-message');
const backupCodesList = document.getElementById('backup-codes-list');
const downloadBtn = document.getElementById('download-codes');
const copyBtn = document.getElementById('copy-codes');

let backupCodes = [];

// Helper to get token
function getToken() {
  return localStorage.getItem('token');
}

// Check authentication
(function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
  }
})();

// Initialize 2FA setup
async function initSetup() {
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/2fa/setup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to initialize 2FA setup');
    }

    const data = await response.json();
    
    // Display QR code
    qrCodeDiv.innerHTML = `<img src="${data.qrCode}" alt="2FA QR Code" />`;
    
    // Display manual secret
    manualSecret.textContent = data.secret;
    
  } catch (error) {
    console.error('Setup error:', error);
    showMessage('Failed to initialize 2FA setup', 'error');
  }
}

// Verify and enable 2FA
async function verifyAndEnable() {
  const token = verificationCode.value.trim();
  
  if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
    showMessage('Please enter a valid 6-digit code', 'error');
    return;
  }
  
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';
  
  try {
    const response = await fetch(`${API_BASE}/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification failed');
    }

    // Success - show backup codes
    backupCodes = data.backupCodes;
    displayBackupCodes(backupCodes);
    
    // Switch to step 2
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    
  } catch (error) {
    console.error('Verify error:', error);
    showMessage(error.message, 'error');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
  }
}

// Display backup codes
function displayBackupCodes(codes) {
  backupCodesList.innerHTML = '';
  codes.forEach(code => {
    const div = document.createElement('div');
    div.className = 'backup-code';
    div.textContent = code;
    backupCodesList.appendChild(div);
  });
}

// Download backup codes as text file
function downloadBackupCodes() {
  const content = backupCodes.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'securepass-backup-codes.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy backup codes to clipboard
function copyBackupCodes() {
  const text = backupCodes.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    alert('Backup codes copied to clipboard!');
  }).catch(() => {
    alert('Failed to copy codes');
  });
}

// Show message
function showMessage(text, type = 'error') {
  step1Message.textContent = text;
  step1Message.className = `message ${type}`;
  step1Message.style.display = 'block';
  
  setTimeout(() => {
    step1Message.style.display = 'none';
  }, 3000);
}

// Event listeners
verifyBtn.addEventListener('click', verifyAndEnable);

verificationCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    verifyAndEnable();
  }
});

if (downloadBtn) {
  downloadBtn.addEventListener('click', downloadBackupCodes);
}

if (copyBtn) {
  copyBtn.addEventListener('click', copyBackupCodes);
}

// Initialize on page load
initSetup();