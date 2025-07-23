/**
 * Base Handler - Abstract base class for all platform handlers
 * Defines common interface and shared functionality
 */
class BaseHandler {
  constructor(platform) {
    this.platform = platform;
    this.memoryEngine = window.memoryEngine;
    this.isEnabled = true;
    this.processedMessages = new Set();
    this.observers = [];
  }

  // Abstract methods - must be implemented by subclasses
  detectConversationArea() { throw new Error('Must implement detectConversationArea'); }
  detectInputFields() { throw new Error('Must implement detectInputFields'); }
  extractMessages() { throw new Error('Must implement extractMessages'); }
  injectMemories(memories) { throw new Error('Must implement injectMemories'); }

  // Shared functionality
  async init() {
    console.log(`LocalBrain: Initializing ${this.platform} handler`);
    await this.setupObservers();
    this.setupKeyboardShortcuts();
  }

  async setupObservers() {
    const conversationArea = this.detectConversationArea();
    if (conversationArea) {
      const observer = new MutationObserver(() => this.handleContentChange());
      observer.observe(conversationArea, { 
        childList: true, 
        subtree: true 
      });
      this.observers.push(observer);
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        this.handleMemoryInjection();
      }
    });
  }

  async handleContentChange() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const messages = await this.extractMessages();
      const newMessages = messages.filter(m => !this.processedMessages.has(m.id));
      
      if (newMessages.length > 0) {
        await this.processNewMessages(newMessages);
        newMessages.forEach(m => this.processedMessages.add(m.id));
      }
    } catch (error) {
      console.error('LocalBrain: Error processing content change:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processNewMessages(messages) {
    // Common message processing logic
    for (const message of messages) {
      if (this.shouldSaveMessage(message)) {
        await this.saveMessage(message);
      }
    }
  }

  shouldSaveMessage(message) {
    return message.content && 
           message.content.length > 10 &&
           !this.isGenericMessage(message.content);
  }

  isGenericMessage(content) {
    const generic = ['hello', 'hi', 'thanks', 'ok', 'yes', 'no'];
    return generic.some(term => content.toLowerCase().trim() === term);
  }

  async saveMessage(message) {
    if (this.memoryEngine) {
      await this.memoryEngine.addMemory({
        content: message.content,
        platform: this.platform,
        timestamp: message.timestamp || Date.now(),
        metadata: message.metadata || {}
      });
    }
  }

  async handleMemoryInjection() {
    const inputField = this.detectInputFields()[0];
    if (!inputField) return;

    const currentText = this.getInputText(inputField);
    const relevantMemories = await this.getRelevantMemories(currentText);
    
    if (relevantMemories.length > 0) {
      await this.injectMemories(relevantMemories);
    }
  }

  async getRelevantMemories(query) {
    if (!this.memoryEngine) return [];
    return await this.memoryEngine.searchMemories(query, 5);
  }

  getInputText(input) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      return input.value;
    } else if (input.contentEditable === 'true') {
      return input.textContent || input.innerText;
    }
    return '';
  }

  setInputText(input, text) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.contentEditable === 'true') {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.focus();
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

window.BaseHandler = BaseHandler;