// sidepanel.js - Logic for the side panel

let allKnowledge = [];
let filteredKnowledge = [];
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadKnowledge();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    searchTimeout = setTimeout(() => {
      if (query) {
        searchKnowledge(query);
      } else {
        applyFilter(currentFilter);
      }
    }, 300);
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentFilter = btn.dataset.filter;
      document.getElementById('searchInput').value = '';
      applyFilter(currentFilter);
    });
  });

  // Save current page FAB
  document.getElementById('saveCurrentPage').addEventListener('click', async () => {
    const btn = document.getElementById('saveCurrentPage');
    btn.textContent = '⏳';
    btn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.runtime.sendMessage({
        action: 'savePage',
        tab: tab
      });

      if (response.success) {
        btn.textContent = '✅';
        setTimeout(() => {
          btn.textContent = '💾';
          btn.disabled = false;
        }, 2000);
        
        // Reload knowledge
        loadKnowledge();
      }
    } catch (error) {
      console.error('Error saving:', error);
      btn.textContent = '❌';
      setTimeout(() => {
        btn.textContent = '💾';
        btn.disabled = false;
      }, 2000);
    }
  });
}

// Load all knowledge
async function loadKnowledge() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllPages' });
    allKnowledge = response.results || [];
    
    updateStats();
    applyFilter(currentFilter);
  } catch (error) {
    console.error('Error loading knowledge:', error);
    showError('Failed to load knowledge');
  }
}

// Update statistics
function updateStats() {
  const total = allKnowledge.length;
  
  // Count today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = allKnowledge.filter(item => {
    const itemDate = new Date(item.savedAt);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate.getTime() === today.getTime();
  }).length;
  
  // Count this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekCount = allKnowledge.filter(item => 
    new Date(item.savedAt) >= weekAgo
  ).length;
  
  document.getElementById('totalCount').textContent = total;
  document.getElementById('todayCount').textContent = todayCount;
  document.getElementById('thisWeek').textContent = weekCount;
}

// Apply time-based filter
function applyFilter(filter) {
  const now = new Date();
  
  switch(filter) {
    case 'today':
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredKnowledge = allKnowledge.filter(item => {
        const itemDate = new Date(item.savedAt);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate.getTime() === today.getTime();
      });
      break;
      
    case 'week':
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredKnowledge = allKnowledge.filter(item => 
        new Date(item.savedAt) >= weekAgo
      );
      break;
      
    case 'month':
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filteredKnowledge = allKnowledge.filter(item => 
        new Date(item.savedAt) >= monthAgo
      );
      break;
      
    default: // 'all'
      filteredKnowledge = [...allKnowledge];
  }
  
  displayKnowledge(filteredKnowledge);
}

// Search knowledge
async function searchKnowledge(query) {
  showLoading();
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'searchKnowledge',
      query: query
    });
    
    filteredKnowledge = response.results;
    displayKnowledge(filteredKnowledge);
  } catch (error) {
    console.error('Error searching:', error);
    showError('Search failed');
  }
}

// Display knowledge cards
function displayKnowledge(items) {
  const contentArea = document.getElementById('contentArea');
  
  if (items.length === 0) {
    contentArea.innerHTML = `
      <div class="empty-state">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
        </svg>
        <h3>No knowledge found</h3>
        <p style="margin-top: 10px;">Start saving pages to build your knowledge base!</p>
      </div>
    `;
    return;
  }
  
  contentArea.innerHTML = `
    <div class="knowledge-grid">
      ${items.map(item => createKnowledgeCard(item)).join('')}
    </div>
  `;
  
  // Add click handlers
  contentArea.querySelectorAll('.knowledge-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('card-menu')) {
        const url = card.dataset.url;
        chrome.tabs.create({ url });
      }
    });
  });
}

// Create knowledge card HTML
function createKnowledgeCard(item) {
  const date = new Date(item.savedAt);
  const timeAgo = getTimeAgo(date);
  const dateStr = date.toLocaleDateString();
  
  return `
    <div class="knowledge-card" data-id="${item.id}" data-url="${escapeHtml(item.url)}">
      <div class="card-header">
        <div class="card-title">${escapeHtml(item.title)}</div>
        <div class="card-menu" title="Options">⋮</div>
      </div>
      <div class="card-summary">${escapeHtml(item.summary)}</div>
      <div class="card-footer">
        <span>📅 ${dateStr}</span>
        <span>${timeAgo}</span>
      </div>
    </div>
  `;
}

// Get human-readable time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'Just now';
}

// Show loading
function showLoading() {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  `;
}

// Show error
function showError(message) {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `
    <div class="empty-state">
      <p>⚠️ ${message}</p>
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('MaarifaHub side panel loaded');