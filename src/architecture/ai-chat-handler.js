/**
 * AI Chat Handler - Specialized for AI conversation platforms
 * Handles ChatGPT, Claude, Gemini, Perplexity, etc.
 */
class AIChatHandler extends BaseHandler {
  constructor(platform) {
    super(platform);
    this.conversationPairs = [];
    this.selectorConfig = this.getPlatformSelectors();
  }

  getPlatformSelectors() {
    const configs = {
      chatgpt: {
        conversation: '[role="main"]',
        messages: '[data-message-author-role]',
        userIndicators: ['user'],
        aiIndicators: ['assistant'],
        inputs: ['textarea[data-id]', '#prompt-textarea', '.ProseMirror'],
        submitButton: '[data-testid="send-button"]'
      },
      claude: {
        conversation: '.conversation',
        messages: '.message, [data-testid*="message"]',
        userIndicators: ['human-message', 'human'],
        aiIndicators: ['assistant-message', 'assistant'],
        inputs: ['.ProseMirror', 'textarea[placeholder*="talk" i]'],
        submitButton: 'button[type="submit"]'
      },
      gemini: {
        conversation: '.conversation-container',
        messages: '.message, [data-testid*="message"]',
        userIndicators: ['user-message', 'user'],
        aiIndicators: ['model-message', 'assistant'],
        inputs: ['textarea[placeholder*="enter" i]', '.ql-editor'],
        submitButton: 'button[aria-label*="Send"]'
      },
      perplexity: {
        conversation: '.prose',
        messages: '.message, [data-testid*="message"]',
        userIndicators: ['user-message', 'user'],
        aiIndicators: ['assistant-message', 'assistant'],
        inputs: ['textarea[placeholder*="ask" i]'],
        submitButton: 'button[type="submit"]'
      },
      grok: {
        conversation: '.conversation',
        messages: '.message, [data-testid*="message"]',
        userIndicators: ['user-message', 'user'],
        aiIndicators: ['assistant-message', 'assistant'],
        inputs: ['textarea[placeholder*="ask" i]'],
        submitButton: 'button[type="submit"]'
      }
    };

    return configs[this.platform] || configs.chatgpt;
  }

  detectConversationArea() {
    return document.querySelector(this.selectorConfig.conversation);
  }

  detectInputFields() {
    const inputs = [];
    for (const selector of this.selectorConfig.inputs) {
      const elements = document.querySelectorAll(selector);
      inputs.push(...Array.from(elements));
    }
    return inputs.filter(input => this.isActiveInput(input));
  }

  isActiveInput(input) {
    return input.offsetParent !== null && // visible
           !input.disabled &&
           !input.readOnly;
  }

  async extractMessages() {
    const conversationArea = this.detectConversationArea();
    if (!conversationArea) return [];

    const messageElements = conversationArea.querySelectorAll(this.selectorConfig.messages);
    const messages = [];

    messageElements.forEach((element, index) => {
      const content = this.extractMessageContent(element);
      if (!content || content.length < 10) return;

      const isAI = this.isAIMessage(element);
      const message = {
        id: `${this.platform}_${Date.now()}_${index}`,
        content: content.trim(),
        isAI,
        timestamp: Date.now(),
        platform: this.platform,
        metadata: {
          element: element.outerHTML.substring(0, 200),
          conversationType: 'ai_chat'
        }
      };

      messages.push(message);
    });

    return messages;
  }

  extractMessageContent(element) {
    // Remove code blocks and complex formatting, keep main text
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    clone.querySelectorAll('button, .copy-button, .timestamp, .avatar').forEach(el => el.remove());
    
    return clone.textContent || clone.innerText || '';
  }

  isAIMessage(element) {
    const elementText = element.className + ' ' + (element.getAttribute('data-testid') || '');
    
    // Check for AI indicators
    const hasAIIndicator = this.selectorConfig.aiIndicators.some(indicator => 
      elementText.includes(indicator)
    );
    
    // Check for user indicators (if found, it's NOT an AI message)
    const hasUserIndicator = this.selectorConfig.userIndicators.some(indicator => 
      elementText.includes(indicator)
    );

    if (hasUserIndicator) return false;
    if (hasAIIndicator) return true;

    // Fallback: check parent elements and siblings
    return this.checkContextForAIMessage(element);
  }

  checkContextForAIMessage(element) {
    // Look for role attributes, avatar indicators, etc.
    let current = element;
    while (current && current !== document.body) {
      const role = current.getAttribute('data-message-author-role') || 
                   current.getAttribute('role') ||
                   current.className;
      
      if (role && this.selectorConfig.aiIndicators.some(indicator => 
          role.includes(indicator))) {
        return true;
      }
      
      if (role && this.selectorConfig.userIndicators.some(indicator => 
          role.includes(indicator))) {
        return false;
      }
      
      current = current.parentElement;
    }

    return false; // Default to user message if unclear
  }

  async injectMemories(memories) {
    const inputField = this.detectInputFields()[0];
    if (!inputField) {
      console.warn('LocalBrain: No input field found for memory injection');
      return;
    }

    const currentText = this.getInputText(inputField);
    const memoryText = this.formatMemoriesForInjection(memories);
    const enhancedText = this.combineTextWithMemories(currentText, memoryText);
    
    this.setInputText(inputField, enhancedText);
    this.showMemoryInjectionNotification(memories.length);
  }

  formatMemoriesForInjection(memories) {
    if (memories.length === 0) return '';

    const memoryText = memories.map((memory, index) => 
      `Memory ${index + 1}: ${memory.content}`
    ).join('\n\n');

    return `\n\n--- Relevant Context from Previous Conversations ---\n${memoryText}\n--- End Context ---\n\n`;
  }

  combineTextWithMemories(currentText, memoryText) {
    if (!currentText.trim()) {
      return memoryText.trim();
    }

    // Insert memories before current text if it's a question
    if (currentText.trim().endsWith('?')) {
      return memoryText + currentText;
    }

    // Otherwise append memories
    return currentText + memoryText;
  }

  showMemoryInjectionNotification(count) {
    const notification = document.createElement('div');
    notification.className = 'localbrain-notification';
    notification.textContent = `🧠 Injected ${count} relevant memories`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-family: system-ui;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  async processNewMessages(messages) {
    await super.processNewMessages(messages);
    
    // AI-specific: Create conversation pairs
    this.updateConversationPairs(messages);
  }

  updateConversationPairs(messages) {
    let currentUserMessage = null;

    for (const message of messages) {
      if (!message.isAI && message.content) {
        currentUserMessage = message;
      } else if (message.isAI && message.content && currentUserMessage) {
        this.conversationPairs.push({
          userInput: currentUserMessage.content,
          aiResponse: message.content,
          timestamp: message.timestamp,
          platform: this.platform
        });
        currentUserMessage = null;
      }
    }
  }
}

window.AIChatHandler = AIChatHandler;