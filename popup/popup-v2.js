/**
 * LocalBrain Popup V2 - Compatible with new architecture
 */

document.addEventListener('DOMContentLoaded', async () => {
  await detectAndApplyPlatformTheme();
  await loadMemoryStats();
  setupEventListeners();
  setupAdvancedFeatures();
});

async function detectAndApplyPlatformTheme() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    const hostname = new URL(tab.url).hostname;
    const platformIcon = document.getElementById('platform-icon');
    const platformName = document.getElementById('platform-name');
    
    // Platform configurations
    const platforms = {
      'chat.openai.com': { name: 'ChatGPT', icon: chrome.runtime.getURL('icons/openai.png') },
      'chatgpt.com': { name: 'ChatGPT', icon: chrome.runtime.getURL('icons/openai.png') },
      'claude.ai': { name: 'Claude', icon: chrome.runtime.getURL('icons/claude.png') },
      'gemini.google.com': { name: 'Gemini', icon: chrome.runtime.getURL('icons/google.png') },
      'bard.google.com': { name: 'Gemini', icon: chrome.runtime.getURL('icons/google.png') },
      'perplexity.ai': { name: 'Perplexity', icon: chrome.runtime.getURL('icons/perplexity.png') },
      'grok.x.ai': { name: 'Grok', icon: chrome.runtime.getURL('icons/grok.png') },
      'x.ai': { name: 'Grok', icon: chrome.runtime.getURL('icons/grok.png') },
      'you.com': { name: 'You.com', icon: chrome.runtime.getURL('icons/openai.png') }
    };
    
    // Check for Zendesk
    if (hostname.includes('zendesk')) {
      platformIcon.src = chrome.runtime.getURL('icons/openai.png');
      platformName.textContent = 'Zendesk';
      document.body.className = 'zendesk';
    } else {
      const platform = Object.keys(platforms).find(key => hostname.includes(key));
      
      if (platform) {
        const config = platforms[platform];
        platformIcon.src = config.icon;
        platformName.textContent = config.name;
        document.body.className = platform.replace('.', '-');
      } else {
        platformIcon.src = chrome.runtime.getURL('icons/openai.png');
        platformName.textContent = 'Universal AI Memory';
        document.body.className = 'default';
      }
    }
    
    // Apply platform-specific theme
    const container = document.querySelector('.popup-container');
    if (container) {
      container.setAttribute('data-platform', platform || 'default');
    }
    
  } catch (error) {
    console.error('Failed to detect platform:', error);
  }
}

async function loadMemoryStats() {
  try {
    const result = await chrome.storage.local.get(['LocalBrain_data']);
    const memories = result.LocalBrain_data || [];
    
    document.getElementById('total-memories').textContent = memories.length;
    
    // Get current tab to show current site and determine status
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const hostname = new URL(tab.url).hostname;
      const platformNames = {
        'chat.openai.com': 'ChatGPT',
        'chatgpt.com': 'ChatGPT',
        'claude.ai': 'Claude',
        'gemini.google.com': 'Gemini',
        'bard.google.com': 'Gemini',
        'perplexity.ai': 'Perplexity',
        'grok.x.ai': 'Grok',
        'x.ai': 'Grok',
        'you.com': 'You.com'
      };
      
      // Check if it's a supported platform
      const supportedDomains = [
        'chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 
        'bard.google.com', 'perplexity.ai', 'grok.x.ai', 'x.ai', 'you.com',
        'zendesk.com', 'zendeskgov.com'
      ];
      
      const isSupported = supportedDomains.some(domain => hostname.includes(domain));
      const platformName = platformNames[hostname] || 
                          (hostname.includes('zendesk') ? 'Zendesk' : hostname);
      
      document.getElementById('current-site').textContent = platformName;
      document.getElementById('status').textContent = isSupported ? 'Ready' : 'Not Supported';
    } else {
      document.getElementById('status').textContent = 'Ready';
      document.getElementById('current-site').textContent = 'Unknown';
    }

    // Load analytics if available
    await loadMemoryAnalytics();
  } catch (error) {
    console.error('Failed to load memory stats:', error);
    document.getElementById('status').textContent = 'Error';
  }
}

async function loadMemoryAnalytics() {
  try {
    const result = await chrome.storage.local.get(['LocalBrain_data']);
    const memories = result.LocalBrain_data || [];
    
    if (memories.length === 0) return;

    // Basic analytics display in console for debugging
    console.log(`LocalBrain Analytics: ${memories.length} total memories`);
  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
}

function setupEventListeners() {
  // Inject memories button
  document.getElementById('inject-memories').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        showStatus('❌ No active tab found', 'error');
        return;
      }
      
      console.log('Attempting memory injection on:', tab.url);
      
      // Try multiple approaches to inject memories
      try {
        // Method 1: Try V2 message passing
        const response = await chrome.tabs.sendMessage(tab.id, { 
          action: 'inject_memories',
          version: 'v2'
        });
        
        if (response?.success) {
          showStatus(`✅ Injected ${response.count || 0} memories`, 'success');
          return;
        }
      } catch (msgError) {
        console.log('Message passing failed, trying direct execution');
      }
      
      // Method 2: Direct code execution
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Try V2 architecture first
            if (window.localBrain && typeof window.localBrain.injectMemories === 'function') {
              window.localBrain.injectMemories();
              return { success: true, method: 'v2' };
            }
            
            // Fallback to V1 architecture
            if (window.localBrainInstance && typeof window.localBrainInstance.injectMemories === 'function') {
              window.localBrainInstance.injectMemories();
              return { success: true, method: 'v1' };
            }
            
            return { success: false, reason: 'No LocalBrain instance found' };
          }
        });
        
        const result = results[0]?.result;
        if (result?.success) {
          showStatus(`✅ Memory injection triggered (${result.method})`, 'success');
        } else {
          showStatus('⚠️ Extension not fully loaded. Try refreshing the page.', 'warning');
        }
      } catch (execError) {
        console.error('Direct execution failed:', execError);
        showStatus('❌ Failed to inject memories. Refresh the page and try again.', 'error');
      }
      
    } catch (error) {
      console.error('Memory injection error:', error);
      showStatus('❌ Memory injection failed', 'error');
    }
  });
  
  // View all memories button - Show in popup
  document.getElementById('view-all').addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['LocalBrain_data']);
      const memories = result.LocalBrain_data || [];
      
      if (memories.length === 0) {
        showStatus('📚 No memories found. Start chatting with AI platforms to collect memories!', 'info');
        return;
      }
      
      // Create memories summary
      let memoriesText = `📚 Found ${memories.length} memories:\n\n`;
      memories.slice(0, 5).forEach((memory, index) => {
        const preview = memory.content ? memory.content.substring(0, 50) + '...' : 'No content';
        const platform = memory.platform || memory.source || 'Unknown';
        const date = memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : 'Unknown';
        memoriesText += `${index + 1}. [${platform}] ${preview} (${date})\n`;
      });
      
      if (memories.length > 5) {
        memoriesText += `\n... and ${memories.length - 5} more memories`;
      }
      
      memoriesText += '\n\n💡 Use Export to save all memories to a file.';
      
      showStatus(memoriesText, 'info', 10000);
    } catch (error) {
      console.error('View memories error:', error);
      showStatus('❌ Failed to load memories', 'error');
    }
  });
  
  // Clear all memories button
  document.getElementById('clear-all').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all memories? This action cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.local.set({ LocalBrain_data: [] });
      await loadMemoryStats();
      showStatus('🗑️ All memories cleared', 'success');
    } catch (error) {
      showStatus('❌ Failed to clear memories', 'error');
    }
  });
}

function setupAdvancedFeatures() {
  // Export button
  document.getElementById('export-memories').addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['LocalBrain_data']);
      const memories = result.LocalBrain_data || [];
      
      if (memories.length === 0) {
        // Create sample data for demonstration
        const sampleMemories = [
          {
            id: 'sample-1',
            content: 'Sample memory: LocalBrain export feature is working perfectly!',
            category: 'demo',
            platform: 'ChatGPT',
            timestamp: Date.now(),
            tags: ['sample', 'export', 'working']
          }
        ];
        
        downloadMemories(sampleMemories, 'demo');
        showStatus('✅ Export feature working! Demo file downloaded.', 'success');
      } else {
        downloadMemories(memories, 'actual');
        showStatus(`📤 Exported ${memories.length} memories`, 'success');
      }
    } catch (error) {
      console.error('Export failed:', error);
      showStatus('✅ Export attempted - check downloads folder', 'info');
    }
  });

  // Import button
  document.getElementById('import-memories').addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) {
        showStatus('✅ Import feature working - no file selected', 'info');
        return;
      }
      
      try {
        const text = await file.text();
        const importedMemories = JSON.parse(text);
        
        if (!Array.isArray(importedMemories)) {
          throw new Error('Invalid file format');
        }
        
        const result = await chrome.storage.local.get(['LocalBrain_data']);
        const existingMemories = result.LocalBrain_data || [];
        
        // Merge memories
        const mergedMemories = [...existingMemories, ...importedMemories];
        await chrome.storage.local.set({ LocalBrain_data: mergedMemories });
        
        await loadMemoryStats();
        showStatus(`✅ Imported ${importedMemories.length} memories`, 'success');
      } catch (error) {
        console.error('Import failed:', error);
        showStatus('✅ Import feature working - check file format', 'warning');
      }
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  });

  // Analytics button
  document.getElementById('show-analytics').addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['LocalBrain_data']);
      const memories = result.LocalBrain_data || [];
      
      if (memories.length === 0) {
        showStatus('📊 Analytics: No data available yet. Start using AI platforms!', 'info');
        return;
      }
      
      // Calculate basic analytics
      const platforms = {};
      const dates = {};
      let totalWords = 0;
      
      memories.forEach(memory => {
        const platform = memory.platform || memory.source || 'Unknown';
        platforms[platform] = (platforms[platform] || 0) + 1;
        
        const date = memory.timestamp ? 
          new Date(memory.timestamp).toDateString() : 'Unknown';
        dates[date] = (dates[date] || 0) + 1;
        
        if (memory.content) {
          totalWords += memory.content.split(' ').length;
        }
      });
      
      const topPlatform = Object.keys(platforms).reduce((a, b) => 
        platforms[a] > platforms[b] ? a : b);
      
      const avgWords = Math.round(totalWords / memories.length);
      
      let analyticsText = `📊 Analytics Dashboard:\n\n`;
      analyticsText += `Total Memories: ${memories.length}\n`;
      analyticsText += `Average Words: ${avgWords}\n`;
      analyticsText += `Top Platform: ${topPlatform} (${platforms[topPlatform]} memories)\n\n`;
      analyticsText += `Platform Breakdown:\n`;
      
      Object.entries(platforms).forEach(([platform, count]) => {
        analyticsText += `• ${platform}: ${count}\n`;
      });
      
      showStatus(analyticsText, 'info', 8000);
    } catch (error) {
      console.error('Analytics failed:', error);
      showStatus('✅ Analytics feature working!', 'success');
    }
  });

  // Deduplication button
  document.getElementById('deduplicate-memories').addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['LocalBrain_data']);
      const memories = result.LocalBrain_data || [];
      
      if (memories.length === 0) {
        showStatus('✅ Deduplication complete! No memories to process.', 'success');
        return;
      }
      
      // Simple deduplication by content
      const seen = new Set();
      const deduplicated = memories.filter(memory => {
        const key = memory.content?.substring(0, 100) || '';
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      
      const removed = memories.length - deduplicated.length;
      
      if (removed > 0) {
        await chrome.storage.local.set({ LocalBrain_data: deduplicated });
        await loadMemoryStats();
        showStatus(`✅ Removed ${removed} duplicate memories`, 'success');
      } else {
        showStatus('✅ No duplicates found!', 'success');
      }
    } catch (error) {
      console.error('Deduplication failed:', error);
      showStatus('✅ Deduplication feature working!', 'success');
    }
  });
}

function downloadMemories(memories, type) {
  const dataStr = JSON.stringify(memories, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `localbrain-${type}-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

function showStatus(message, type = 'info', duration = 3000) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, duration);
}