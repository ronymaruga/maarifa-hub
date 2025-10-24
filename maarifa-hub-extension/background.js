// background.js - Service Worker for KnowledgeVault

// Check if AI capabilities are available
let aiCapabilities = {
  canSummarize: false,
  canPrompt: false,
  canTranslate: false,
  canWrite: false,
  canRewrite: false,
  canProofread: false
};

// Initialize AI capabilities on extension load
async function initializeAI() {
  try {
    // Check Summarizer API
    if ('ai' in self && 'summarizer' in self.ai) {
      const summarizerCapabilities = await self.ai.summarizer.capabilities();
      aiCapabilities.canSummarize = summarizerCapabilities.available === 'readily';
    }

    // Check Prompt API (Language Model)
    if ('ai' in self && 'languageModel' in self.ai) {
      const promptCapabilities = await self.ai.languageModel.capabilities();
      aiCapabilities.canPrompt = promptCapabilities.available === 'readily';
    }

    // Check Writer API
    if ('ai' in self && 'writer' in self.ai) {
      const writerCapabilities = await self.ai.writer.capabilities();
      aiCapabilities.canWrite = writerCapabilities.available === 'readily';
    }

    // Check Rewriter API
    if ('ai' in self && 'rewriter' in self.ai) {
      const rewriterCapabilities = await self.ai.rewriter.capabilities();
      aiCapabilities.canRewrite = rewriterCapabilities.available === 'readily';
    }

    console.log('AI Capabilities:', aiCapabilities);
  } catch (error) {
    console.error('Error checking AI capabilities:', error);
  }
}

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'saveToKnowledgeVault',
    title: '💾 Save to KnowledgeVault',
    contexts: ['page', 'selection']
  });
  
  chrome.contextMenus.create({
    id: 'openSidePanel',
    title: '📋 Open KnowledgeVault Workspace',
    contexts: ['page']
  });

  // Initialize AI
  initializeAI();
});

// Handle keyboard command for side panel
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    chrome.sidePanel.open();
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveToKnowledgeVault') {
    await savePage(tab, info.selectionText);
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'savePage') {
    savePage(message.tab, message.selection).then(sendResponse);
    return true; // Keep channel open for async response
  } else if (message.action === 'searchKnowledge') {
    searchKnowledge(message.query).then(sendResponse);
    return true;
  } else if (message.action === 'getAllPages') {
    getAllPages().then(sendResponse);
    return true;
  } else if (message.action === 'getCapabilities') {
    sendResponse(aiCapabilities);
    return true;
  } else if (message.action === 'rewriteNote') {
    rewriteText(message.text).then(sendResponse);
    return true;
  }
});

// Save a page to the knowledge base
async function savePage(tab, selectionText = null) {
  try {
    // Get page content from the active tab
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageContent
    });

    const pageContent = result.result;
    const contentToSummarize = selectionText || pageContent.text;

    // Generate summary using Summarizer API
    let summary = '';
    if (aiCapabilities.canSummarize && contentToSummarize) {
      try {
        summary = await summarizeContent(contentToSummarize);
      } catch (error) {
        console.error('Summarization failed:', error);
        summary = contentToSummarize.substring(0, 500) + '...';
      }
    } else {
      summary = contentToSummarize.substring(0, 500) + '...';
    }

    // Create knowledge entry
    const entry = {
      id: Date.now().toString(),
      title: tab.title,
      url: tab.url,
      summary: summary,
      fullText: contentToSummarize.substring(0, 10000), // Store first 10k chars
      savedAt: new Date().toISOString(),
      tags: [],
      isSelection: !!selectionText
    };

    // Save to Chrome storage
    await chrome.storage.local.get(['knowledgeBase'], (result) => {
      const knowledgeBase = result.knowledgeBase || [];
      knowledgeBase.unshift(entry); // Add to beginning
      
      chrome.storage.local.set({ knowledgeBase }, () => {
        console.log('Page saved successfully:', entry.title);
      });
    });

    return { success: true, entry };
  } catch (error) {
    console.error('Error saving page:', error);
    return { success: false, error: error.message };
  }
}

// Function to extract page content (runs in page context)
function extractPageContent() {
  // Try to get main content
  const article = document.querySelector('article') || 
                  document.querySelector('main') || 
                  document.body;

  // Get text content, removing script and style tags
  const clone = article.cloneNode(true);
  const scripts = clone.querySelectorAll('script, style, nav, footer, header');
  scripts.forEach(el => el.remove());

  const text = clone.innerText || clone.textContent;
  
  return {
    text: text.trim(),
    title: document.title,
    url: window.location.href
  };
}

// Summarize content using Chrome's Summarizer API
async function summarizeContent(text) {
  if (!aiCapabilities.canSummarize) {
    throw new Error('Summarizer not available');
  }

  // Limit text length to prevent token overflow
  const maxLength = 4000;
  const textToSummarize = text.length > maxLength 
    ? text.substring(0, maxLength) 
    : text;

  try {
    const summarizer = await self.ai.summarizer.create({
      type: 'tl;dr',
      format: 'plain-text',
      length: 'medium'
    });

    const summary = await summarizer.summarize(textToSummarize);
    summarizer.destroy();
    
    return summary;
  } catch (error) {
    console.error('Summarization error:', error);
    throw error;
  }
}

// Search knowledge base using Prompt API
async function searchKnowledge(query) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['knowledgeBase'], async (result) => {
      const knowledgeBase = result.knowledgeBase || [];

      if (knowledgeBase.length === 0) {
        resolve({ results: [], message: 'No saved knowledge yet' });
        return;
      }

      // If AI is available, use semantic search
      if (aiCapabilities.canPrompt && query.trim()) {
        try {
          const semanticResults = await semanticSearch(query, knowledgeBase);
          resolve({ results: semanticResults });
          return;
        } catch (error) {
          console.error('Semantic search failed, falling back to keyword search:', error);
        }
      }

      // Fallback: simple keyword search
      const queryLower = query.toLowerCase();
      const filtered = knowledgeBase.filter(entry => {
        return entry.title.toLowerCase().includes(queryLower) ||
               entry.summary.toLowerCase().includes(queryLower) ||
               entry.fullText.toLowerCase().includes(queryLower);
      });

      resolve({ results: filtered });
    });
  });
}

// Semantic search using Prompt API
async function semanticSearch(query, knowledgeBase) {
  // Create context from knowledge base (limit to prevent token overflow)
  const maxEntries = 10;
  const context = knowledgeBase.slice(0, maxEntries).map((entry, idx) => {
    return `[${idx}] Title: ${entry.title}\nSummary: ${entry.summary}\n`;
  }).join('\n');

  const prompt = `You are a knowledge base search assistant. Given the user's query and a list of saved articles, identify which articles are most relevant.

User Query: "${query}"

Saved Articles:
${context}

Return ONLY the numbers (indices) of relevant articles, separated by commas. If no articles are relevant, return "none".
Example: 0,2,5`;

  try {
    const session = await self.ai.languageModel.create({
      systemPrompt: 'You are a helpful search assistant. Be concise and only return article numbers.'
    });

    const response = await session.prompt(prompt);
    session.destroy();

    // Parse response to get indices
    if (response.toLowerCase().includes('none')) {
      return [];
    }

    const indices = response.match(/\d+/g)?.map(Number) || [];
    const results = indices
      .filter(idx => idx < knowledgeBase.length)
      .map(idx => knowledgeBase[idx]);

    return results;
  } catch (error) {
    console.error('Semantic search error:', error);
    throw error;
  }
}

// Get all saved pages
function getAllPages() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['knowledgeBase'], (result) => {
      resolve({ results: result.knowledgeBase || [] });
    });
  });
}

// Rewrite text using Rewriter API
async function rewriteText(text) {
  if (!aiCapabilities.canRewrite) {
    return { success: false, error: 'Rewriter not available' };
  }

  try {
    const rewriter = await self.ai.rewriter.create({
      tone: 'more-formal',
      length: 'as-is'
    });

    const rewritten = await rewriter.rewrite(text);
    rewriter.destroy();

    return { success: true, text: rewritten };
  } catch (error) {
    console.error('Rewrite error:', error);
    return { success: false, error: error.message };
  }
}

console.log('KnowledgeVault background service worker loaded');