// popup.js - Popup interface logic

let currentResults = [];

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Get elements
  const searchInput = document.getElementById('searchInput');
  const savePageBtn = document.getElementById('savePageBtn');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const openWorkspaceBtn = document.getElementById('openWorkspaceBtn');
  const contentDiv = document.getElementById('content');

  // Check AI capabilities
  const capabilities = await chrome.runtime.sendMessage({ action: 'getCapabilities' });
  console.log('AI Capabilities:', capabilities);

  // Load all saved pages on startup
  loadAllPages();

  // Search as user types (with debounce)
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query.length === 0) {
      loadAllPages();
      return;
    }

    searchTimeout = setTimeout(() => {
      searchKnowledge(query);
    }, 500);
  });

  // Handle Enter key in search
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = e.target.value.trim();
      if (query) {
        searchKnowledge(query);
      }
    }
  });

  // Save current page button
  savePageBtn.addEventListener('click', async () => {
    savePageBtn.disabled = true;
    savePageBtn.textContent = '💾 Saving...';

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to background to save page
      const response = await chrome.runtime.sendMessage({
        action: 'savePage',
        tab: tab
      });

      if (response.success) {
        savePageBtn.textContent = '✅ Saved!';
        setTimeout(() => {
          savePageBtn.textContent = '💾 Save This Page';
          savePageBtn.disabled = false;
        }, 2000);

        // Reload the list
        loadAllPages();
      } else {
        savePageBtn.textContent = '❌ Error';
        setTimeout(() => {
          savePageBtn.textContent = '💾 Save This Page';
          savePageBtn.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving page:', error);
      savePageBtn.textContent = '❌ Error';
      setTimeout(() => {
        savePageBtn.textContent = '💾 Save This Page';
        savePageBtn.disabled = false;
      }, 2000);
    }
  });

  // View all button
  viewAllBtn.addEventListener('click', () => {
    searchInput.value = '';
    loadAllPages();
  });
});

// Load all saved pages
async function loadAllPages() {
  showLoading();

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllPages' });
    currentResults = response.results;
    displayResults(currentResults);
  } catch (error) {
    console.error('Error loading pages:', error);
    showError('Failed to load saved pages');
  }
}

// Search knowledge base
async function searchKnowledge(query) {
  showLoading();

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'searchKnowledge',
      query: query
    });

    currentResults = response.results;
    displayResults(currentResults, query);
  } catch (error) {
    console.error('Error searching:', error);
    showError('Search failed');
  }
}

// Display results in the UI
function displayResults(results, query = '') {
  const contentDiv = document.getElementById('content');

  if (results.length === 0) {
    if (query) {
      contentDiv.innerHTML = `
        <div class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <p>No results found for "${query}"</p>
          <p style="margin-top: 10px;">Try a different search term</p>
        </div>
      `;
    } else {
      contentDiv.innerHTML = `
        <div class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
          </svg>
          <p>No saved knowledge yet.</p>
          <p style="margin-top: 10px;">Click "Save This Page" to get started!</p>
        </div>
      `;
    }
    return;
  }

  // Display results
  contentDiv.innerHTML = results.map(entry => {
    const date = new Date(entry.savedAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="knowledge-item" data-id="${entry.id}">
        <div class="item-title">${escapeHtml(entry.title)}</div>
        <div class="item-summary">${escapeHtml(entry.summary)}</div>
        <div class="item-date">📅 ${dateStr}</div>
      </div>
    `;
  }).join('');

  // Add click handlers to open URLs
  contentDiv.querySelectorAll('.knowledge-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const entry = results.find(e => e.id === id);
      if (entry) {
        chrome.tabs.create({ url: entry.url });
      }
    });
  });
}

// Show loading state
function showLoading() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p style="margin-top: 15px;">Loading...</p>
    </div>
  `;
}

// Show error message
function showError(message) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <div class="empty-state">
      <p>⚠️ ${message}</p>
    </div>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('KnowledgeVault popup loaded');