console.log('SecurePass Background v3.0 - Auto-Save Ready');

// Store vault globally
let vaultCache = [];
let token = null;
let vaultUnlocked = false;
let lastActivityTimestamp = Date.now();
let lockCheckInterval = null;

const AUTO_LOCK_TIME = 1 * 60 * 1000;

async function initLastActivity() {
  const result = await chrome.storage.local.get(['lastActivityTimestamp']);
  if (!result.lastActivityTimestamp) {
    const now = Date.now();
    await chrome.storage.local.set({ lastActivityTimestamp: now });
    console.log('Initialized last activity time:', new Date(now).toLocaleTimeString());
  }
}

// Update activity timestamp
async function updateActivity() {
  const now = Date.now();
  await chrome.storage.local.set({ lastActivityTimestamp: now });
  console.log('Activity updated at:', new Date(now).toLocaleTimeString());
}

// Get last activity time
async function getLastActivityTime() {
  const result = await chrome.storage.local.get(['lastActivityTimestamp']);
  return result.lastActivityTimestamp || Date.now();
}

// Start checking for lock every minute
function startLockChecker() {
  if (lockCheckInterval) clearInterval(lockCheckInterval);
  
  lockCheckInterval = setInterval(async() => {
    const lastActivity = await getLastActivityTime();
    const timeSinceLastActivity = Date.now() - lastActivity;
    console.log(`Time since last activity: ${Math.round(timeSinceLastActivity/1000)} seconds`);
    
    if (timeSinceLastActivity > AUTO_LOCK_TIME) {
      console.log('Auto-locking due to inactivity at:', new Date().toLocaleTimeString());
      vaultUnlocked = false;
      await chrome.storage.local.set({ vaultUnlocked: false });
    }
  }, 10000); // Check every minute
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background message:', request.action);
  
  switch (request.action) {
    case 'userActivity':
      console.log('User activity detected, resetting timer');
      updateActivity().then(() => sendResponse({ success: true }));
      return true;
      
    case 'unlockVault':
      vaultUnlocked = true;
      updateActivity().then(() => {
        chrome.storage.local.set({ vaultUnlocked: true }, () => {
          startLockChecker();
          console.log('Vault unlocked, activity tracking started');
          sendResponse({ success: true });
        });
      });
      return true;
      
    case 'lockVault':
      vaultUnlocked = false;
      chrome.storage.local.set({ vaultUnlocked: false });
      if (lockCheckInterval) clearInterval(lockCheckInterval);
      console.log('🔒 Vault locked');
      sendResponse({ success: true });
      break;
      
    case 'checkSession':
      (async () => {
        const [storage, lastActivity] = await Promise.all([
          chrome.storage.local.get(['vaultUnlocked', 'sessionActive']),
          getLastActivityTime()
        ]);
        
        const timeSinceLastActivity = Date.now() - lastActivity;
        console.log(`Session check - Time since last activity: ${Math.round(timeSinceLastActivity/1000)} seconds`);
        console.log(`AUTO_LOCK_TIME: ${AUTO_LOCK_TIME/1000} seconds`);
        
        // Check if should be auto-locked
        let isLocked = storage.vaultUnlocked === false;
        if (storage.vaultUnlocked && timeSinceLastActivity > AUTO_LOCK_TIME) {
          console.log('Auto-locking during session check');
          isLocked = true;
          await chrome.storage.local.set({ vaultUnlocked: false });
        }
        
        sendResponse({ 
          vaultUnlocked: !isLocked, 
          sessionActive: storage.sessionActive || false 
        });
      })();
      return true;
      
    case 'getVault':
      sendResponse({ vault: vaultCache });
      break;
      
    case 'saveCredentials':
      handleSaveCredentials(request.credentials, sendResponse);
      return true;
      
    case 'getToken':
      sendResponse({ token });
      break;
      
    case 'setToken':
      token = request.token;
      chrome.storage.local.set({ token });
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true;
});

async function handleSaveCredentials(credentials, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['token']);
    const token = result.token;
    
    if (!token) {
      console.log('NO TOKEN');
      sendResponse({ success: false, error: 'Login first' });
      return;
    }
    
    console.log('Auto-saving:', credentials);
    
    
    const response = await fetch('http://localhost:3000/api/passwords/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    console.log('📡 Response:', response.status);
    
    if (response.ok) {
      vaultCache.push(credentials);
      sendResponse({ success: true });
      console.log('AUTO-SAVE SUCCESS!');
    } else {
      const errorText = await response.text();
      console.log('Backend:', response.status, errorText.slice(0, 100));
      sendResponse({ success: false, error: `Error ${response.status}` });
    }
  } catch (error) {
    console.error('Network:', error.message);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle extension startup
chrome.runtime.onStartup.addListener(async() => {
  console.log('Extension starting up');
  await initLastActivity();
  // Browser just started - require full login
  await chrome.storage.local.set({ 
    vaultUnlocked: false,
    sessionActive: false 
  });
  const result = await chrome.storage.local.get(['vault', 'token']);
  vaultCache = result.vault || [];
  token = result.token;
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async() => {
  console.log('Extension installed/updated');
  await initLastActivity();
  await chrome.storage.local.set({ 
    vaultUnlocked: false,
    sessionActive: false 
  });
// Load vault and token
  const result = await chrome.storage.local.get(['vault', 'token']);
  vaultCache = result.vault || [];
  token = result.token;
});

// Start the checker 
startLockChecker();

// Initialize and start
initLastActivity().then(() => {
  startLockChecker();
});
console.log('🔒 SecurePass Background ready!');
