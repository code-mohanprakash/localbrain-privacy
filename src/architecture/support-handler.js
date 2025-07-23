/**
 * Support Handler - Specialized for customer support platforms
 * Handles Zendesk, Intercom, Freshdesk, etc.
 * Different from AI chat - focuses on ticket context and customer history
 */
class SupportHandler extends BaseHandler {
  constructor(platform) {
    super(platform);
    this.ticketContext = {};
    this.customerHistory = [];
    this.selectorConfig = this.getPlatformSelectors();
    this.selectorDetector = new SelectorDetector(platform, 'SUPPORT');
  }

  getPlatformSelectors() {
    const configs = {
      zendesk: {
        conversation: '[data-test-id="ticket-conversation"], .ticket-conversation, .workspace-chat',
        messages: [
          '[data-test-id="ticket-conversation-event"]',
          '.event',
          '.comment',
          '.message',
          '.conversation-item',
          '[role="article"]',
          '.ticket-comment',
          '.comment-item'
        ],
        inputs: [
          '[data-test-id="omnichannel-text-input"]',
          '.editor',
          'textarea',
          '[contenteditable="true"]',
          '.comment-input',
          '.reply-input',
          '.message-input',
          '.zendesk-editor'
        ],
        customerIndicators: ['.customer', '[data-test-id="customer-avatar"]', '.requester'],
        agentIndicators: ['.agent', '[data-test-id="agent-avatar"]', '.assignee'],
        internalIndicators: ['.internal', '.internal-note', '.private'],
        submitButton: '[data-test-id="submit-button"], button[type="submit"]',
        ticketInfo: '.ticket-header, .ticket-metadata, [data-test-id="ticket-header"]'
      }
    };

    return configs[this.platform] || configs.zendesk;
  }

  detectConversationArea() {
    // Try intelligent detection first
    const detected = this.selectorDetector.detectConversationArea();
    if (detected) {
      console.log('LocalBrain: Found conversation area via intelligent detection');
      return detected;
    }

    // Fallback to hardcoded selectors
    console.log('LocalBrain: Falling back to hardcoded selectors for conversation area');
    return document.querySelector(this.selectorConfig.conversation);
  }

  detectInputFields() {
    // Try intelligent detection first
    const detected = this.selectorDetector.detectInputFields();
    if (detected && detected.length > 0) {
      console.log(`LocalBrain: Found ${detected.length} input fields via intelligent detection`);
      return detected;
    }

    // Fallback to hardcoded selectors
    console.log('LocalBrain: Falling back to hardcoded selectors for input fields');
    const inputs = [];
    for (const selector of this.selectorConfig.inputs) {
      const elements = document.querySelectorAll(selector);
      inputs.push(...Array.from(elements));
    }
    return inputs.filter(input => this.isActiveInput(input));
  }

  isActiveInput(input) {
    return input.offsetParent !== null && 
           !input.disabled &&
           !input.readOnly &&
           input.getBoundingClientRect().height > 20; // Exclude hidden inputs
  }

  async extractMessages() {
    const conversationArea = this.detectConversationArea();
    if (!conversationArea) return [];

    const messages = [];
    
    // Extract ticket context first
    await this.extractTicketContext();

    // Extract messages using all selectors
    for (const selector of this.selectorConfig.messages) {
      const messageElements = conversationArea.querySelectorAll(selector);
      
      messageElements.forEach((element, index) => {
        const content = this.extractMessageContent(element);
        if (!content || content.length < 5) return; // Support messages can be shorter

        const messageType = this.determineMessageType(element);
        const message = {
          id: `${this.platform}_${Date.now()}_${index}_${selector.replace(/[^a-zA-Z0-9]/g, '')}`,
          content: content.trim(),
          isAI: false, // Support platforms don't have AI messages
          messageType, // 'customer', 'agent', 'internal'
          timestamp: this.extractTimestamp(element) || Date.now(),
          platform: this.platform,
          metadata: {
            element: element.outerHTML.substring(0, 200),
            conversationType: 'support_ticket',
            ticketId: this.ticketContext.id,
            messageType
          }
        };

        messages.push(message);
      });
    }

    return this.deduplicateMessages(messages);
  }

  async extractTicketContext() {
    const ticketInfoElement = document.querySelector(this.selectorConfig.ticketInfo);
    if (ticketInfoElement) {
      this.ticketContext = {
        id: this.extractTicketId(),
        subject: this.extractTicketSubject(),
        status: this.extractTicketStatus(),
        priority: this.extractTicketPriority(),
        customer: this.extractCustomerInfo()
      };
    }
  }

  extractTicketId() {
    // Try multiple ways to get ticket ID
    const url = window.location.href;
    const ticketMatch = url.match(/tickets\/(\d+)/);
    if (ticketMatch) return ticketMatch[1];

    const breadcrumb = document.querySelector('.breadcrumbs, [data-test-id="breadcrumb"]');
    if (breadcrumb) {
      const idMatch = breadcrumb.textContent.match(/#(\d+)/);
      if (idMatch) return idMatch[1];
    }

    return null;
  }

  extractTicketSubject() {
    const selectors = [
      '[data-test-id="ticket-subject"]',
      '.ticket-subject',
      'h1',
      '.ticket-header h1',
      '.ticket-title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }
    return null;
  }

  extractTicketStatus() {
    const statusElements = document.querySelectorAll('[data-test-id*="status"], .status, .ticket-status');
    for (const element of statusElements) {
      const status = element.textContent.trim().toLowerCase();
      if (['open', 'pending', 'solved', 'closed', 'new'].includes(status)) {
        return status;
      }
    }
    return null;
  }

  extractTicketPriority() {
    const priorityElements = document.querySelectorAll('[data-test-id*="priority"], .priority, .ticket-priority');
    for (const element of priorityElements) {
      const priority = element.textContent.trim().toLowerCase();
      if (['low', 'normal', 'high', 'urgent'].includes(priority)) {
        return priority;
      }
    }
    return null;
  }

  extractCustomerInfo() {
    const customerElements = document.querySelectorAll('.requester, .customer-info, [data-test-id*="requester"]');
    if (customerElements.length > 0) {
      return customerElements[0].textContent.trim();
    }
    return null;
  }

  extractMessageContent(element) {
    const clone = element.cloneNode(true);
    
    // Remove Zendesk-specific UI elements
    clone.querySelectorAll(
      '.timestamp, .avatar, .author, .actions, .metadata, button, .copy-button'
    ).forEach(el => el.remove());
    
    return clone.textContent || clone.innerText || '';
  }

  determineMessageType(element) {
    const elementText = element.className + ' ' + (element.getAttribute('data-test-id') || '');
    
    // Check for customer message
    if (this.selectorConfig.customerIndicators.some(indicator => 
        elementText.includes(indicator))) {
      return 'customer';
    }
    
    // Check for agent message
    if (this.selectorConfig.agentIndicators.some(indicator => 
        elementText.includes(indicator))) {
      return 'agent';
    }
    
    // Check for internal note
    if (this.selectorConfig.internalIndicators.some(indicator => 
        elementText.includes(indicator))) {
      return 'internal';
    }

    // Fallback: analyze context
    return this.analyzeMessageContext(element);
  }

  analyzeMessageContext(element) {
    // Look for user avatars, role indicators, etc.
    let current = element;
    while (current && current !== document.body) {
      const classes = current.className || '';
      const testId = current.getAttribute('data-test-id') || '';
      const combined = classes + ' ' + testId;

      if (combined.includes('customer') || combined.includes('requester')) {
        return 'customer';
      }
      if (combined.includes('agent') || combined.includes('assignee')) {
        return 'agent';
      }
      if (combined.includes('internal') || combined.includes('private')) {
        return 'internal';
      }

      current = current.parentElement;
    }

    return 'unknown';
  }

  extractTimestamp(element) {
    const timeSelectors = [
      'time',
      '.timestamp',
      '[data-test-id*="timestamp"]',
      '.time',
      '.date'
    ];

    for (const selector of timeSelectors) {
      const timeElement = element.querySelector(selector) || 
                          element.closest('.message, .comment')?.querySelector(selector);
      
      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime') || 
                        timeElement.getAttribute('title') ||
                        timeElement.textContent;
        
        const parsed = new Date(datetime);
        if (!isNaN(parsed.getTime())) {
          return parsed.getTime();
        }
      }
    }

    return null;
  }

  deduplicateMessages(messages) {
    const seen = new Set();
    return messages.filter(message => {
      const key = `${message.content.substring(0, 50)}_${message.messageType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async injectMemories(memories) {
    const inputField = this.detectInputFields()[0];
    if (!inputField) {
      console.warn('LocalBrain: No input field found for memory injection');
      return;
    }

    const currentText = this.getInputText(inputField);
    const memoryText = this.formatMemoriesForSupport(memories);
    const enhancedText = this.combineTextWithMemories(currentText, memoryText);
    
    this.setInputText(inputField, enhancedText);
    this.showMemoryInjectionNotification(memories.length);
  }

  formatMemoriesForSupport(memories) {
    if (memories.length === 0) return '';

    const relevantMemories = memories.filter(memory => 
      memory.platform === this.platform || 
      memory.metadata?.ticketId === this.ticketContext.id ||
      this.isRelevantToCustomer(memory)
    );

    if (relevantMemories.length === 0) return '';

    const memoryText = relevantMemories.map((memory, index) => {
      const source = memory.metadata?.ticketId ? 
        `Ticket #${memory.metadata.ticketId}` : 
        `Previous ${memory.platform} conversation`;
      
      return `[${source}] ${memory.content}`;
    }).join('\n\n');

    return `\n\n--- Relevant Customer History ---\n${memoryText}\n--- End History ---\n\n`;
  }

  isRelevantToCustomer(memory) {
    const customerName = this.ticketContext.customer;
    if (!customerName) return false;

    return memory.content.toLowerCase().includes(customerName.toLowerCase()) ||
           memory.metadata?.customer === customerName;
  }

  combineTextWithMemories(currentText, memoryText) {
    if (!currentText.trim()) {
      return memoryText.trim();
    }

    // For support, always prepend context
    return memoryText + currentText;
  }

  showMemoryInjectionNotification(count) {
    const notification = document.createElement('div');
    notification.className = 'localbrain-notification';
    notification.textContent = `🎫 Injected ${count} relevant customer context`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2196F3;
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
    
    // Support-specific: Update customer history
    this.updateCustomerHistory(messages);
  }

  updateCustomerHistory(messages) {
    const customerMessages = messages.filter(m => m.messageType === 'customer');
    this.customerHistory.push(...customerMessages);
    
    // Keep only recent customer messages (last 50)
    if (this.customerHistory.length > 50) {
      this.customerHistory = this.customerHistory.slice(-50);
    }
  }

  shouldSaveMessage(message) {
    // Support platforms: save shorter messages, different criteria
    return message.content && 
           message.content.length > 5 && // Shorter minimum for support
           !this.isGenericSupportMessage(message.content);
  }

  isGenericSupportMessage(content) {
    const generic = [
      'thank you',
      'thanks',
      'received',
      'acknowledged',
      'ok',
      'yes',
      'no',
      'please hold',
      'one moment'
    ];
    
    const lowerContent = content.toLowerCase().trim();
    return generic.some(term => lowerContent === term || lowerContent.includes(term));
  }
}

window.SupportHandler = SupportHandler;