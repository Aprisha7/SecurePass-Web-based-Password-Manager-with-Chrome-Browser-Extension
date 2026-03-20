const API_BASE = "http://localhost:3000/api";

// DOM Elements
const usersTableBody = document.getElementById("users-table-body");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const adminMessage = document.getElementById("admin-message");
const userSearch = document.getElementById("user-search");
const clearSearchBtn = document.getElementById("clear-search");
const totalUsersEl = document.getElementById("total-users");
const totalAdminsEl = document.getElementById("total-admins");
const totalRegularEl = document.getElementById("total-regular");
const totalPasswordsEl = document.getElementById("total-passwords");

let allUsers = [];
let currentUserEmail = null;

// Helper to get token
function getToken() {
  return localStorage.getItem("token");
}

// Helper to get user info
function getUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

// Auth check and admin verification
(function initAdmin() {
  // First check if actually on the admin page
  const isAdminPage = window.location.pathname.includes('admin.html');
  
  // If not on admin page, don't run any admin code
  if (!isAdminPage) {
    return;
  }

  const token = getToken();
  const user = getUser();
  
  console.log('Admin page - Token:', token);
  console.log('Admin page - User:', user);
  
  if (!token || !user) {
    window.location.href = "login.html";
    return;
  }



  currentUserEmail = user.email;
  
  // Load data
  loadUsers();
  loadStats();
})();

// Load all users
async function loadUsers() {
  showLoading(true);

  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 403) {
        showMessage('Admin access required', 'error');
        setTimeout(() => window.location.href = 'vault.html', 2000);
      }
      throw new Error('Failed to load users');
    }

    const data = await response.json();
    allUsers = data.users || [];
    renderUsers(allUsers);
    
  } catch (error) {
    console.error('Load users error:', error);
    showMessage('Failed to load users', 'error');
  } finally {
    showLoading(false);
  }
}

// Load statistics
async function loadStats() {
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to load stats');

    const stats = await response.json();
    
    if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
    if (totalAdminsEl) totalAdminsEl.textContent = stats.totalAdmins || 0;
    if (totalRegularEl) totalRegularEl.textContent = stats.totalRegular || 0;
    if (totalPasswordsEl) totalPasswordsEl.textContent = stats.totalPasswords || 0;
    
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

function renderUsers(users) {
  usersTableBody.innerHTML = '';

  if (users.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  users.forEach(user => {
    const tr = document.createElement('tr');
    const isCurrentUser = user.email === currentUserEmail;
    const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

    tr.innerHTML = `
      <td>${escapeHtml(user.email || '')} ${isCurrentUser ? '<strong>(You)</strong>' : ''}</td>
      <td>
        <span class="role-badge ${user.role === 'admin' ? 'admin' : 'user'}">
          ${user.role || 'user'}
        </span>
      </td>
      <td>${joinedDate}</td>
      <td>
        ${user.role !== 'admin' ? `
          <button 
            class="action-btn promote-btn" 
            onclick="promoteUser('${user.email}')"
            ${isCurrentUser ? 'disabled' : ''}
          >
            Promote to Admin
          </button>
        ` : `
          <button 
            class="action-btn demote-btn" 
            onclick="demoteUser('${user.email}')"
            ${isCurrentUser ? 'disabled' : ''}
          >
            Demote to User
          </button>
        `}

        <!-- Delete User Button (can't delete yourself) -->
          <button 
            class="action-btn delete-user-btn" 
            onclick="deleteUser('${user._id}', '${user.email}')"
            ${isCurrentUser ? 'disabled' : ''}
            title="${isCurrentUser ? 'Cannot delete your own account' : 'Delete user'}"
          >
            🗑️ Delete
          </button>
        </div>
      </td>
    `;

    usersTableBody.appendChild(tr);
  });
}

// Delete user
async function deleteUser(userId, email) {
  if (!confirm(`⚠️ Are you sure you want to delete user "${email}"?\n\nThis action cannot be undone and will delete all their saved passwords.`)) {
    return;
  }
  
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/admin/user/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Failed to delete user', 'error');
      return;
    }

    showMessage(`User "${email}" deleted successfully`, 'success');
    loadUsers(); // Refresh user list
    loadStats(); // Refresh stats
    
  } catch (error) {
    console.error('Delete user error:', error);
    showMessage('Network error while deleting user', 'error');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Promote user
async function promoteUser(email) {
  if (!confirm(`Are you sure you want to promote ${email} to admin?`)) return;

  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/admin/promote`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Failed to promote user', 'error');
      return;
    }

    showMessage(`${email} promoted to admin successfully`, 'success');
    loadUsers(); // Refresh user list
    loadStats(); // Refresh stats
    
  } catch (error) {
    console.error('Promote error:', error);
    showMessage('Network error while promoting user', 'error');
  }
}

// Demote user
async function demoteUser(email) {
  if (!confirm(`Are you sure you want to demote ${email} to regular user?`)) return;

  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}/admin/demote`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Failed to demote user', 'error');
      return;
    }

    showMessage(`${email} demoted to user successfully`, 'success');
    loadUsers(); // Refresh user list
    loadStats(); // Refresh stats
    
  } catch (error) {
    console.error('Demote error:', error);
    showMessage('Network error while demoting user', 'error');
  }
}

// Search functionality
function handleSearch() {
  const query = userSearch.value.toLowerCase().trim();
  
  if (!query) {
    renderUsers(allUsers);
    clearSearchBtn.style.display = 'none';
    return;
  }

  clearSearchBtn.style.display = 'inline-block';

  const filtered = allUsers.filter(user => 
    user.email?.toLowerCase().includes(query)
  );

  renderUsers(filtered);
}

function clearSearch() {
  userSearch.value = '';
  clearSearchBtn.style.display = 'none';
  renderUsers(allUsers);
}

// Show/hide loading state
function showLoading(show) {
  if (show) {
    loadingState.style.display = 'block';
    usersTableBody.style.display = 'none';
  } else {
    loadingState.style.display = 'none';
    usersTableBody.style.display = '';
  }
}

// Show message
function showMessage(text, type = 'success') {
  adminMessage.textContent = text;
  adminMessage.className = `message ${type}`;
  adminMessage.style.display = 'block';

  setTimeout(() => {
    adminMessage.style.display = 'none';
  }, 3000);
}

// Event listeners
if (userSearch) {
  userSearch.addEventListener('input', debounce(handleSearch, 300));
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', clearSearch);
}

// Debounce function
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

// Make functions global for onclick handlers
window.promoteUser = promoteUser;
window.demoteUser = demoteUser;
