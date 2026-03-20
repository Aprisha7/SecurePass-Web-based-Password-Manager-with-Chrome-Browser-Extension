console.log('🔒 SecurePass content script v3.3 - Backend Token Fix');

// ========== DOMAIN WHITELIST/BLACKLIST ==========
const SECUREPASS_DOMAINS = [
  '127.0.0.1:5501',
  'localhost:5501',
  '127.0.0.1',
  'localhost'
];

// Check if current site is your own vault
function isSecurePassDomain() {
  const currentUrl = window.location.href.toLowerCase();
  const currentHostname = window.location.hostname.toLowerCase();
  const currentPort = window.location.port;
  
  console.log('Checking domain:', currentUrl);
  
  // Check for local development with port 5501
  if ((currentHostname === '127.0.0.1' || currentHostname === 'localhost') && currentPort === '5501') {
    // Only disable auto-save on actual vault pages
    if (currentUrl.includes('/login') || currentUrl.includes('/vault') || currentUrl.includes('/admin')) {
      console.log('🔒 SecurePass vault page detected - auto-save disabled');
      return true;
    }
  }
  
  return false;
}

let processedFields = new Set();
let savePromptShown = false;
let recentSaves = new Set();

// **HELPER FUNCTIONS**
function dispatchEvents(field) {
  ['input', 'change', 'keyup', 'focus'].forEach(type => {
    field.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

function showNotification(msg, type = 'success') {
  const notif = document.createElement('div');
  notif.textContent = msg;
  notif.style.cssText = `
    position: fixed; top: 20px; right: 20px; 
    background: ${type === 'error' ? '#ef4444' : '#10b981'}; 
    color: white; padding: 12px 20px; border-radius: 8px; 
    z-index: 999999; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function isFieldVisible(field) {
  const rect = field.getBoundingClientRect();
  const style = window.getComputedStyle(field);
  return rect.width > 0 && rect.height > 0 && 
         style.display !== 'none' && style.visibility !== 'hidden';
}

// Password generator function
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

function createSecurePassIcon(field) {
  const existing = field.parentElement.querySelector('.securepass-icon');
  if (existing) existing.remove();
  
  field.style.paddingRight = '110px';  
  
  const container = field.parentElement;
  container.style.position = 'relative';
  
  const icon = document.createElement('img');
  icon.className = 'securepass-icon';
  icon.src = chrome.runtime.getURL('icon.png');
  icon.alt = 'SecurePass';
  
  icon.style.cssText = `
    position: absolute !important; 
    right: 60px !important;  /* Position it left of the 👁 icon */
    top: 50% !important;
    transform: translateY(-50%) !important; 
    width: 28px !important; 
    height: 28px !important;
    border-radius: 50% !important;
    cursor: pointer !important; 
    z-index: 2147483646 !important;  /* Lower z-index than 👁 */
    box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important; 
    transition: all 0.2s !important;
    object-fit: cover !important;
    background: white !important;
    border: 1px solid #e5e7eb !important;
  `;
  
  container.appendChild(icon);
  
  const toggleBtn = container.querySelector('.toggle-password, [type="button"]');
  if (toggleBtn) {
    toggleBtn.style.position = "absolute";
    toggleBtn.style.right = '8px !important';
    toggleBtn.style.top = '50%';
    toggleBtn.style.zIndex = '2147483647 !important';  
  }
  
  icon.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('CLICK DETECTED!');

    chrome.storage.local.get(['token'], async (result) => {
      if (!result.token) {
        showNotification('No vault data - login in popup');
        icon.innerHTML = '❌';
        setTimeout(() => icon.innerHTML = '🔓', 1500);
        return;
      }
      
      try {
        const currentFullUrl = window.location.href.toLowerCase();
        const currentHostname = window.location.hostname.replace('www.', '').toLowerCase();
        
        console.log('Current URL:', currentFullUrl);
        
        const response = await fetch('http://localhost:3000/api/passwords', {
          headers: { 'Authorization': `Bearer ${result.token}` }
        });
        
        if (response.ok) {
          const vault = await response.json();
          console.log('Vault:', vault.length, 'items');
          
          const match = vault.find(item => {
            const savedUrl = item.website?.toLowerCase();
            if (!savedUrl) return false;
           
            let savedHostname = '';
            try {
              savedHostname = new URL(savedUrl.startsWith('http') ? savedUrl : 'https://' + savedUrl)
                .hostname.replace('www.', '').toLowerCase();
            } catch (e) {
              console.log('⚠️ Invalid URL in vault:', savedUrl);
              return false;
            }
            
            return savedUrl === currentFullUrl || 
                   savedHostname === currentHostname || 
                   currentFullUrl.includes(savedHostname);
          });
          
          if (match) {
            console.log('MATCH FOUND:', match.website);
            field.value = match.password;
            dispatchEvents(field);
            
            const usernameField = document.querySelector(
              'input[type="email"], input[name*="email"], input[name*="user"], #email, #username, [autocomplete*="username"]'
            );
            if (usernameField && match.username) {
              usernameField.value = match.username;
              dispatchEvents(usernameField);
            }
            
            showNotification(`Filled for ${match.website}`);
            icon.innerHTML = '✅';
          } else {
            showNotification(`ℹ️ Save ${currentHostname} first`);
            icon.innerHTML = '💾';
          }
        } else {
          showNotification('Session expired');
          icon.innerHTML = '❌';
        }
      } catch (error) {
        console.error('Error:', error);
        showNotification('Network error');
        icon.innerHTML = '❌';
      }
      
      setTimeout(() => icon.innerHTML = '🔓', 1500);
    });
  });
  
  icon.onmouseenter = () => icon.style.transform = 'translateY(-50%) scale(1.1)';
  icon.onmouseleave = () => icon.style.transform = 'translateY(-50%)';
}

// Add generate button next to password fields
function addGenerateButtonToField(field) {
  if (field.parentElement.querySelector('.securepass-generate-btn')) return;
  
  const container = field.parentElement;
  container.style.position = 'relative';
  
  const generateBtn = document.createElement('button');
  generateBtn.className = 'securepass-generate-btn';
  generateBtn.innerHTML = '🔑';
  generateBtn.title = 'Generate strong password';
  
  generateBtn.style.cssText = `
    position: absolute !important;
    right: 30px !important;  /* Adjust based on other icons */
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 28px !important;
    height: 28px !important;
    border-radius: 6px !important;
    color: white !important;
    border: none !important;
    cursor: pointer !important;
    z-index: 2147483646 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 16px !important;
    transition: all 0.2s !important;
  `;
  
  generateBtn.onmouseenter = () => {
    generateBtn.style.transform = 'translateY(-50%) scale(1.1)';
  };
  
  generateBtn.onmouseleave = () => {
    generateBtn.style.transform = 'translateY(-50%) scale(1)';
  };
  
  generateBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('⚡ Generate button clicked!'); // ADD THIS
    
    // Generate password
    const password = generateSecurePassword(16, true, true);
    console.log('Generated password:', password); // ADD THIS
  
    // Fill the field
    field.value = password;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Show success
    generateBtn.innerHTML = '✅';
    setTimeout(() => {
      generateBtn.innerHTML = '🔑';
    }, 1500);
    
    // Copy to clipboard
    await navigator.clipboard.writeText(password);
    showNotification('Password generated!', 'success');
  };
  
  container.appendChild(generateBtn);
}

// AUTO-SAVE FUNCTION
async function setupAutoSave() {
  if (isSecurePassDomain()) {
    return; // Exit immediately without any auto-save
  }

  if (savePromptShown) return;
  
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    if (form.dataset.securepassListener) return;
    form.dataset.securepassListener = 'true';
    
    form.addEventListener('submit', async (e) => {
      if (savePromptShown) return;
      
      const passwordField = document.querySelector('input[type="password"]');
      const usernameField = document.querySelector(
        'input[type="email"], input[name*="email"], input[name*="user"], #email, #username'
      );
      
      if (!passwordField?.value || !usernameField?.value) return;

      const fullUrl = window.location.href;
      console.log('Full URL:', fullUrl);
      
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(fullUrl)) {
        console.log('Invalid URL - must be full https://');
        showNotification('Full URL required (https://...)', 'error');
        return;
      }
      
      const saveKey = `${fullUrl}_${usernameField.value}`;
      if (recentSaves.has(saveKey)) {
        console.log('Skip recent save:', saveKey);
        return;
      }
      
      savePromptShown = true;
      e.preventDefault();
      
      try {
        // Check if already exists
        chrome.storage.local.get(['token'], async (result) => {
          if (!result.token) {
            savePromptShown = false;
            return;
          }
          
          const checkResponse = await fetch('http://localhost:3000/api/passwords', {
            headers: { 'Authorization': `Bearer ${result.token}` }
          });
          
          if (checkResponse.ok) {
            const vault = await checkResponse.json();
            const exists = vault.some(item => 
              item.website === fullUrl && 
              item.username?.toLowerCase() === usernameField.value.toLowerCase()
            );
            
            if (exists) {
              showNotification(`Already saved for ${new URL(fullUrl).hostname}`);
              setTimeout(() => form.submit(), 500);
              savePromptShown = false;
              return;
            }
          }
          
          // Show save prompt
          const saveIt = confirm(
            `💾 Save for FULL URL?\n\n` +
            `🌐 ${fullUrl.slice(0, 60)}${fullUrl.length > 60 ? '...' : ''}\n` +
            `👤 ${usernameField.value}\n` +
            `🔑 ••••••••`
          );
          
          if (saveIt) {
            const credentials = {
              website: fullUrl,
              username: usernameField.value,
              password: passwordField.value
            };
            
            const saveResponse = await fetch('http://localhost:3000/api/passwords/add', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${result.token}`
              },
              body: JSON.stringify(credentials)
            });
            
            if (saveResponse.ok) {
              recentSaves.add(saveKey);
              setTimeout(() => recentSaves.delete(saveKey), 5 * 60 * 1000);
              showNotification(`Saved ${new URL(fullUrl).hostname}!`);
            } else {
              const errorData = await saveResponse.json();
              showNotification(`${errorData.error || 'Save failed'}`, 'error');
            }
          }
          
          savePromptShown = false;
          setTimeout(() => form.submit(), 500);
        });
      } catch (error) {
        console.error('Auto-save error:', error);
        savePromptShown = false;
        setTimeout(() => form.submit(), 500);
      }
    });
  });
}

function setupLoginButtonWatcher() {
  if (isSecurePassDomain()) {
    console.log('🔒 SecurePass vault detected - login watcher disabled');
    return;
  }
  console.log('Setting up login button watcher...');
  
  // Common login button selectors
  const buttonSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button.login-button',
    'button.signin-button',
    'button[data-testid*="login"]',
    'button[data-testid*="signin"]',
    'a[data-testid*="login"]',
    'a[data-testid*="signin"]',
    '[aria-label*="login" i]',
    '[aria-label*="sign in" i]',
    '[aria-label*="log in" i]'
  ];
  
  // Find all potential login buttons
  const loginButtons = document.querySelectorAll(buttonSelectors.join(','));
  console.log(`Found ${loginButtons.length} potential login buttons`);

  loginButtons.forEach(button => {
    if (button.dataset.securepassWatcher) return;
    button.dataset.securepassWatcher = 'true';
    
    button.addEventListener('click', (e) => {
      console.log('Login button clicked');
      
      // Small delay to let fields populate
      setTimeout(() => {
        // Find password field with multiple selectors
        const passwordField = 
          document.querySelector('input[type="password"]') ||
          document.querySelector('input[name*="pass"]') ||
          document.querySelector('input[id*="pass"]') ||
          document.querySelector('[data-testid*="password"]') ||
          document.querySelector('input[placeholder*="password" i]') ||
          document.querySelector('input[placeholder*="pass" i]');
        
        // Find username field with multiple selectors
        const usernameField = 
          document.querySelector('input[type="email"]') ||
          document.querySelector('input[name*="email"]') ||
          document.querySelector('input[name*="user"]') ||
          document.querySelector('#email') ||
          document.querySelector('#username') ||
          document.querySelector('[data-testid*="email"]') ||
          document.querySelector('[data-testid*="username"]') ||
          document.querySelector('input[placeholder*="email" i]') ||
          document.querySelector('input[placeholder*="user" i]');
        
          console.log('Password field found:', !!passwordField);
          console.log('Username field found:', !!usernameField);

        if (passwordField?.value && usernameField?.value) {
          console.log('Credentials found, triggering auto-save');
          triggerAutoSave(usernameField, passwordField);
        }
      }, 500);
    });
  });

// Also watch for any button with login-related text
  const allButtons = document.querySelectorAll('button, a[role="button"], input[type="button"]');
  allButtons.forEach(button => {
    if (button.dataset.securepassWatcher) return;
    
    const buttonText = button.textContent?.toLowerCase() || button.value?.toLowerCase() || '';
    if (buttonText.includes('login') || buttonText.includes('sign in') || buttonText.includes('log in')) {
      if (button.dataset.securepassWatcher) return;
      button.dataset.securepassWatcher = 'true';
      
      button.addEventListener('click', (e) => {
        console.log('Login button clicked (text match)');
        
        setTimeout(() => {
          const passwordField = 
            document.querySelector('input[type="password"]') ||
            document.querySelector('input[name*="pass" i]') ||
            document.querySelector('input[id*="pass" i]');
          
          const usernameField = 
            document.querySelector('input[type="email"]') ||
            document.querySelector('input[name*="email" i]') ||
            document.querySelector('input[name*="user" i]') ||
            document.querySelector('#email') ||
            document.querySelector('#username');
          
          if (passwordField?.value && usernameField?.value) {
            triggerAutoSave(usernameField, passwordField);
          }
        }, 500);
      });
    }
  });
}

// Function to trigger auto-save
async function triggerAutoSave(usernameField, passwordField) {
  if (isSecurePassDomain()) {
    console.log('🔒 SecurePass vault detected - auto-save aborted');
    return;
  }
  
  if (savePromptShown) return;
  
  const fullUrl = window.location.href;
  console.log('Auto-save triggered for:', fullUrl);
  
  const urlPattern = /^https?:\/\/.+/i;
  if (!urlPattern.test(fullUrl)) {
    console.log('Invalid URL');
    return;
  }
  
  const saveKey = `${fullUrl}_${usernameField.value}`;
  if (recentSaves.has(saveKey)) {
    console.log('⏭ Skip recent save:', saveKey);
    return;
  }
  
  savePromptShown = true;
  
  chrome.storage.local.get(['token'], async (result) => {
    if (!result.token) {
      console.log('No token found');
      savePromptShown = false;
      return;
    }
    
    try {
      // Check if already exists
      const checkResponse = await fetch('http://localhost:3000/api/passwords', {
        headers: { 'Authorization': `Bearer ${result.token}` }
      });
      
      if (checkResponse.ok) {
        const vault = await checkResponse.json();
        const exists = vault.some(item => 
          item.website === fullUrl && 
          item.username?.toLowerCase() === usernameField.value.toLowerCase()
        );
        
        if (exists) {
          showNotification(`Already saved for ${new URL(fullUrl).hostname}`);
          savePromptShown = false;
          return;
        }
      }
      
      // Show save prompt
      const saveIt = confirm(
        `💾 Save password for ${new URL(fullUrl).hostname}?\n\n` +
        `🌐 ${fullUrl.slice(0, 60)}${fullUrl.length > 60 ? '...' : ''}\n` +
        `👤 ${usernameField.value}\n` +
        `🔑 ••••••••`
      );
      
      if (saveIt) {
        const credentials = {
          website: fullUrl,
          username: usernameField.value,
          password: passwordField.value
        };
        
        const saveResponse = await fetch('http://localhost:3000/api/passwords/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${result.token}`
          },
          body: JSON.stringify(credentials)
        });
        
        if (saveResponse.ok) {
          recentSaves.add(saveKey);
          setTimeout(() => recentSaves.delete(saveKey), 5 * 60 * 1000);
          showNotification(`Saved for ${new URL(fullUrl).hostname}!`);
        } else {
          const errorData = await saveResponse.json();
          showNotification(`${errorData.error || 'Save failed'}`, 'error');
        }
      }
      
      savePromptShown = false;
      
    } catch (error) {
      console.error('Auto-save error:', error);
      savePromptShown = false;
    }
  });
}

// **INJECT ICONS**
function injectIconsToAllPasswordFields() {
  const selectors = [
   'input[type="password"]',                    
    'input[autocomplete="new-password"]',         
    'input[autocomplete="current-password"]',     
    'input[name$="password" i]',                   
    'input[name$="pass" i]',                       
    'input[id$="password" i]',                      
    'input[id$="pass" i]',                          
    'input[placeholder*="password" i]',             
    'input[placeholder*="pass" i]'   
  ];
  
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(field => {
      const isSearchField = 
        field.id?.toLowerCase().includes('search') ||
        field.name?.toLowerCase().includes('search') ||
        field.placeholder?.toLowerCase().includes('search') ||
        field.className?.toLowerCase().includes('search') ||
        field.type === 'search' ||
        field.getAttribute('aria-label')?.toLowerCase().includes('search');
      
      if (isSearchField) {
        return; // Skip this field
      }
      
      const isGeneratorField = 
        field.id?.toLowerCase().includes('gen-password') ||
        field.id?.toLowerCase().includes('generated') ||
        field.placeholder?.toLowerCase().includes('generate') ||
        field.readOnly || 
        field.disabled;   
      
      if (isGeneratorField) {
        console.log('🔑 Skipping generator field:', field);
        return; // Skip generator fields
      }
      
      if (!processedFields.has(field) && isFieldVisible(field)) {
        createSecurePassIcon(field);
        addGenerateButtonToField(field);
        processedFields.add(field);
      }
    });
  });
}
    

function startWatchingForNewFields() {
  const observer = new MutationObserver(() => {
    injectIconsToAllPasswordFields();
    setupAutoSave();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'class']
  });
  
  setInterval(() => {
    injectIconsToAllPasswordFields();
    setupAutoSave();
  }, 2000);
}

// MESSAGE HANDLERS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillNow' && request.credentials) {
    const passwordField = document.querySelector('input[type="password"]');
    const usernameField = document.querySelector('input[type="email"], input[name*="email"], input[name*="user"]');
    
    if (passwordField) {
      passwordField.value = request.credentials.password;
      dispatchEvents(passwordField);
      
      if (usernameField && request.credentials.username) {
        usernameField.value = request.credentials.username;
        dispatchEvents(usernameField);
      }
      
      showNotification(`Filled ${request.credentials.website}!`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }
  return true;
});

// **INIT**
function initSecurePass() {
  console.log('🚀 SecurePass v3.3 initializing...');
  injectIconsToAllPasswordFields();
  startWatchingForNewFields();
  setupAutoSave();
  setupLoginButtonWatcher();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSecurePass);
} else {
  setTimeout(initSecurePass, 100);
}

console.log('🔒 SecurePass v3.3 - Backend Token Integration Ready!');
