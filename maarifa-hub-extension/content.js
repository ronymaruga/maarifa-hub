// content.js - Content script that runs on web pages

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageContent') {
    const content = extractPageContent();
    sendResponse(content);
  } else if (message.action === 'showSavedIndicator') {
    showSavedIndicator();
  }
  return true;
});

// Extract content from the current page
function extractPageContent() {
  // Try to get main content area
  const article = document.querySelector('article') || 
                  document.querySelector('main') || 
                  document.querySelector('[role="main"]') ||
                  document.body;

  // Clone to avoid modifying the actual page
  const clone = article.cloneNode(true);
  
  // Remove unwanted elements
  const unwanted = clone.querySelectorAll('script, style, nav, footer, header, iframe, .ad, .advertisement');
  unwanted.forEach(el => el.remove());

  // Get clean text
  const text = clone.innerText || clone.textContent;
  
  // Get metadata
  const metadata = {
    title: document.title,
    url: window.location.href,
    text: text.trim(),
    author: document.querySelector('meta[name="author"]')?.content || '',
    description: document.querySelector('meta[name="description"]')?.content || '',
    publishDate: document.querySelector('meta[property="article:published_time"]')?.content || ''
  };

  return metadata;
}

// Add a visual indicator when page is saved (optional)
function showSavedIndicator() {
  const indicator = document.createElement('div');
  indicator.textContent = 'Saved to MaarifaHub';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(indicator);

  // Remove after 3 seconds
  setTimeout(() => {
    indicator.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

console.log('MaarifaHub content script loaded');