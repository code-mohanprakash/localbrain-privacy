/**
 * Selector Detector - Intelligently detects page elements without hardcoded selectors
 * Uses machine learning-like approaches to identify input fields, messages, etc.
 */
class SelectorDetector {
  constructor(platform, platformType) {
    this.platform = platform;
    this.platformType = platformType;
    this.cache = new Map();
    this.confidence = new Map();
  }

  // Main entry points
  detectConversationArea() {
    const cacheKey = 'conversation_area';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const candidates = this.findConversationCandidates();
    const best = this.selectBestCandidate(candidates, 'conversation');
    
    this.cache.set(cacheKey, best);
    return best;
  }

  detectInputFields() {
    const cacheKey = 'input_fields';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const candidates = this.findInputCandidates();
    const filtered = candidates.filter(input => this.scoreInputField(input) > 0.5);
    
    this.cache.set(cacheKey, filtered);
    return filtered;
  }

  detectMessages() {
    const conversationArea = this.detectConversationArea();
    if (!conversationArea) return [];

    const cacheKey = 'message_elements';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const candidates = this.findMessageCandidates(conversationArea);
    const scored = candidates.map(el => ({
      element: el,
      score: this.scoreMessageElement(el)
    })).filter(item => item.score > 0.3);

    const messages = scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.element);

    this.cache.set(cacheKey, messages);
    return messages;
  }

  // Conversation area detection
  findConversationCandidates() {
    const candidates = [];

    // Look for common conversation container patterns
    const selectors = [
      '[role="main"]',
      '[role="log"]',
      '.conversation',
      '.chat',
      '.messages',
      '.thread',
      '.timeline',
      '.comments',
      '.ticket-conversation',
      'main',
      '#main-content',
      '.main-content'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        candidates.push({
          element: el,
          score: this.scoreConversationArea(el),
          method: 'selector'
        });
      });
    });

    // Look for elements with lots of message-like children
    document.querySelectorAll('div, section, main').forEach(el => {
      if (this.looksLikeConversationContainer(el)) {
        candidates.push({
          element: el,
          score: this.scoreConversationArea(el),
          method: 'heuristic'
        });
      }
    });

    return candidates;
  }

  scoreConversationArea(element) {
    let score = 0;

    // Size and position indicators
    const rect = element.getBoundingClientRect();
    if (rect.height > window.innerHeight * 0.3) score += 0.3; // Takes significant screen space
    if (rect.width > window.innerWidth * 0.5) score += 0.2;

    // Content indicators
    const childCount = element.children.length;
    if (childCount > 5) score += 0.2; // Has multiple children
    if (childCount > 20) score += 0.1; // Has many children

    // Semantic indicators
    const text = element.className + ' ' + element.id + ' ' + element.tagName.toLowerCase();
    const conversationKeywords = ['conversation', 'chat', 'messages', 'thread', 'timeline', 'comments', 'ticket'];
    conversationKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 0.15;
    });

    // Role attributes
    const role = element.getAttribute('role');
    if (role === 'main' || role === 'log') score += 0.25;

    // Scrollability (conversations are often scrollable)
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
      score += 0.1;
    }

    // Message-like children
    let messageChildren = 0;
    Array.from(element.children).forEach(child => {
      if (this.looksLikeMessage(child)) messageChildren++;
    });
    if (messageChildren > childCount * 0.5) score += 0.2; // More than half are message-like

    return Math.min(score, 1);
  }

  looksLikeConversationContainer(element) {
    const rect = element.getBoundingClientRect();
    
    // Must be reasonably sized
    if (rect.height < 200 || rect.width < 300) return false;
    
    // Must have multiple children
    if (element.children.length < 3) return false;
    
    // Check if children look like messages
    let messageCount = 0;
    Array.from(element.children).forEach(child => {
      if (this.looksLikeMessage(child)) messageCount++;
    });
    
    return messageCount >= 3; // At least 3 message-like children
  }

  // Input field detection
  findInputCandidates() {
    const candidates = [];

    // Standard form inputs
    document.querySelectorAll('input, textarea').forEach(input => {
      candidates.push(input);
    });

    // Contenteditable elements
    document.querySelectorAll('[contenteditable="true"]').forEach(editor => {
      candidates.push(editor);
    });

    // Rich text editors (common patterns)
    document.querySelectorAll('.editor, .ql-editor, .ProseMirror, .draft-editor').forEach(editor => {
      candidates.push(editor);
    });

    return candidates.filter(el => el.offsetParent !== null); // Only visible elements
  }

  scoreInputField(input) {
    let score = 0;

    // Visibility and interaction
    if (input.offsetParent === null) return 0; // Hidden
    if (input.disabled || input.readOnly) score -= 0.3;

    // Position scoring (inputs near bottom are often primary)
    const rect = input.getBoundingClientRect();
    const relativeY = rect.bottom / window.innerHeight;
    if (relativeY > 0.7) score += 0.3; // Near bottom of screen

    // Size scoring
    if (rect.height > 30) score += 0.2; // Reasonable height
    if (rect.width > 200) score += 0.2; // Reasonable width

    // Attribute analysis
    const placeholder = input.placeholder || '';
    const ariaLabel = input.getAttribute('aria-label') || '';
    const combined = (placeholder + ' ' + ariaLabel).toLowerCase();

    // Platform-specific keywords
    const inputKeywords = this.getInputKeywords();
    inputKeywords.forEach(keyword => {
      if (combined.includes(keyword)) score += 0.2;
    });

    // Element type scoring
    if (input.tagName === 'TEXTAREA') score += 0.2;
    if (input.contentEditable === 'true') score += 0.15;

    // Context scoring - is it near a send button?
    if (this.hasNearbySubmitButton(input)) score += 0.3;

    // Focus capability
    if (input.tabIndex >= 0) score += 0.1;

    return Math.min(score, 1);
  }

  getInputKeywords() {
    const common = ['message', 'send', 'type', 'enter', 'write', 'reply', 'comment'];
    
    const platformSpecific = {
      AI_CHAT: ['ask', 'chat', 'prompt', 'question', 'talk'],
      SUPPORT: ['describe', 'issue', 'problem', 'help', 'explain']
    };

    return [...common, ...(platformSpecific[this.platformType] || [])];
  }

  hasNearbySubmitButton(input) {
    const inputRect = input.getBoundingClientRect();
    
    // Look for buttons near the input
    const buttons = document.querySelectorAll('button, [role="button"]');
    
    for (const button of buttons) {
      const buttonRect = button.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(buttonRect.left - inputRect.right, 2) + 
        Math.pow(buttonRect.top - inputRect.top, 2)
      );
      
      if (distance < 100) { // Within 100px
        const buttonText = (button.textContent + ' ' + button.getAttribute('aria-label')).toLowerCase();
        if (buttonText.includes('send') || buttonText.includes('submit')) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Message detection
  findMessageCandidates(conversationArea) {
    const candidates = [];
    const walker = document.createTreeWalker(
      conversationArea,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (this.looksLikeMessage(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      candidates.push(node);
    }

    return candidates;
  }

  looksLikeMessage(element) {
    // Basic size check
    const rect = element.getBoundingClientRect();
    if (rect.height < 20 || rect.width < 100) return false;

    // Must have text content
    const text = element.textContent?.trim();
    if (!text || text.length < 5) return false;

    // Check for message-like characteristics
    let messageIndicators = 0;

    // Contains meaningful text
    if (text.length > 20) messageIndicators++;
    
    // Has message-like structure
    if (element.querySelector('p, div, span')) messageIndicators++;
    
    // Has author/timestamp indicators
    if (element.querySelector('.author, .user, .time, .timestamp, time')) messageIndicators++;
    
    // Block-level element (messages are usually blocks)
    const style = window.getComputedStyle(element);
    if (style.display === 'block' || style.display === 'flex') messageIndicators++;

    return messageIndicators >= 2;
  }

  scoreMessageElement(element) {
    let score = 0;

    // Content quality
    const text = element.textContent?.trim() || '';
    if (text.length > 50) score += 0.3;
    if (text.length > 200) score += 0.2;

    // Structure indicators
    if (element.querySelector('p, div')) score += 0.1;
    if (element.querySelector('.author, .user, .avatar')) score += 0.2;
    if (element.querySelector('time, .timestamp')) score += 0.2;

    // Position and size
    const rect = element.getBoundingClientRect();
    if (rect.height > 40) score += 0.1;
    if (rect.width > window.innerWidth * 0.3) score += 0.1;

    // Semantic indicators
    const className = element.className || '';
    const messageKeywords = ['message', 'comment', 'event', 'item', 'entry'];
    messageKeywords.forEach(keyword => {
      if (className.includes(keyword)) score += 0.15;
    });

    return Math.min(score, 1);
  }

  selectBestCandidate(candidates, type) {
    if (candidates.length === 0) return null;

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    // Log the selection process
    console.log(`LocalBrain: Found ${candidates.length} ${type} candidates`);
    console.log(`LocalBrain: Best ${type} candidate has score ${candidates[0].score}`);
    
    // Return the best candidate if it meets minimum threshold
    const threshold = type === 'conversation' ? 0.4 : 0.3;
    if (candidates[0].score >= threshold) {
      this.confidence.set(type, candidates[0].score);
      return candidates[0].element || candidates[0];
    }

    console.warn(`LocalBrain: No ${type} candidate meets threshold (${threshold})`);
    return null;
  }

  // Utility methods
  clearCache() {
    this.cache.clear();
    console.log('LocalBrain: Selector cache cleared');
  }

  getConfidence(type) {
    return this.confidence.get(type) || 0;
  }

  debugInfo() {
    return {
      platform: this.platform,
      platformType: this.platformType,
      cacheKeys: Array.from(this.cache.keys()),
      confidence: Object.fromEntries(this.confidence)
    };
  }
}

window.SelectorDetector = SelectorDetector;