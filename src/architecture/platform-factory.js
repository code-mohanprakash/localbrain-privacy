/**
 * Platform Factory - Creates appropriate handlers for different platform types
 * Single responsibility: Detect platform and create correct handler
 */
class PlatformFactory {
  static PLATFORM_TYPES = {
    AI_CHAT: {
      chatgpt: ['chat.openai.com', 'chatgpt.com'],
      claude: ['claude.ai'],
      gemini: ['gemini.google.com', 'bard.google.com'],
      perplexity: ['perplexity.ai'],
      grok: ['grok.x.ai', 'x.ai'],
      you: ['you.com']
    },
    SUPPORT: {
      zendesk: ['zendesk.com', 'zendeskgov.com'],
      intercom: ['intercom.com'],
      freshdesk: ['freshdesk.com']
    },
    CODE: {
      github: ['github.com'],
      gitlab: ['gitlab.com']
    },
    DOCS: {
      notion: ['notion.so'],
      confluence: ['atlassian.net']
    }
  };

  static detectPlatform() {
    const hostname = window.location.hostname;
    const path = window.location.pathname;

    console.log('LocalBrain: Detecting platform for:', hostname + path);

    // Check each platform type
    for (const [type, platforms] of Object.entries(this.PLATFORM_TYPES)) {
      for (const [platform, domains] of Object.entries(platforms)) {
        if (domains.some(domain => hostname.includes(domain))) {
          // Special cases
          if (platform === 'you' && !path.includes('search')) continue;
          if (platform === 'github' && !this.isGitHubRelevantPage(path)) continue;
          
          return { platform, type };
        }
      }
    }

    console.warn('LocalBrain: Unknown platform:', hostname);
    return { platform: 'unknown', type: 'UNKNOWN' };
  }

  static isGitHubRelevantPage(path) {
    // Only activate on GitHub pages where memory might be useful
    return path.includes('/issues/') || 
           path.includes('/pull/') || 
           path.includes('/discussions/');
  }

  static createHandler() {
    const { platform, type } = this.detectPlatform();
    
    if (type === 'UNKNOWN') {
      console.warn('LocalBrain: No handler available for platform:', platform);
      return null;
    }

    console.log(`LocalBrain: Creating ${type} handler for ${platform}`);

    switch (type) {
      case 'AI_CHAT':
        if (!window.AIChatHandler) {
          console.error('LocalBrain: AIChatHandler not loaded');
          return null;
        }
        return new window.AIChatHandler(platform);
        
      case 'SUPPORT':
        if (!window.SupportHandler) {
          console.error('LocalBrain: SupportHandler not loaded');
          return null;
        }
        return new window.SupportHandler(platform);
        
      case 'CODE':
        // Future: CodeHandler for GitHub/GitLab
        console.log('LocalBrain: Code platform support coming soon');
        return null;
        
      case 'DOCS':
        // Future: DocsHandler for Notion/Confluence
        console.log('LocalBrain: Docs platform support coming soon');
        return null;
        
      default:
        console.warn('LocalBrain: Unsupported platform type:', type);
        return null;
    }
  }

  static getSupportedPlatforms() {
    const supported = [];
    
    for (const [type, platforms] of Object.entries(this.PLATFORM_TYPES)) {
      if (type === 'AI_CHAT' || type === 'SUPPORT') {
        for (const [platform, domains] of Object.entries(platforms)) {
          supported.push({
            platform,
            type,
            domains,
            supported: true
          });
        }
      } else {
        for (const [platform, domains] of Object.entries(platforms)) {
          supported.push({
            platform,
            type,
            domains,
            supported: false,
            reason: 'Coming soon'
          });
        }
      }
    }
    
    return supported;
  }

  static isPlatformSupported(hostname) {
    const { type } = this.detectPlatform();
    return type === 'AI_CHAT' || type === 'SUPPORT';
  }

  static async loadRequiredHandlers() {
    // Dynamically load only the handlers we need
    const { type } = this.detectPlatform();
    
    const loadPromises = [];
    
    if (type === 'AI_CHAT' && !window.AIChatHandler) {
      loadPromises.push(this.loadScript('src/architecture/ai-chat-handler.js'));
    }
    
    if (type === 'SUPPORT' && !window.SupportHandler) {
      loadPromises.push(this.loadScript('src/architecture/support-handler.js'));
    }
    
    if (loadPromises.length > 0) {
      console.log('LocalBrain: Loading required handlers...');
      await Promise.all(loadPromises);
    }
  }

  static loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

window.PlatformFactory = PlatformFactory;