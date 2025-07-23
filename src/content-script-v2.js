/**
 * LocalBrain Content Script V2 - Clean Architecture
 * Uses platform-specific handlers and intelligent selector detection
 */
class LocalBrainV2 {
  constructor() {
    this.handler = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.maxInitAttempts = 3;
    
    console.log('LocalBrain V2: Starting initialization');
    this.init();
  }

  async init() {
    try {
      this.initializationAttempts++;
      
      // Check if we're on a supported platform
      if (!PlatformFactory.isPlatformSupported(window.location.hostname)) {
        console.log('LocalBrain V2: Platform not supported, skipping initialization');
        return;
      }

      // Wait for dependencies
      await this.waitForDependencies();
      
      // Load required handlers
      await PlatformFactory.loadRequiredHandlers();
      
      // Create platform-specific handler
      this.handler = PlatformFactory.createHandler();
      
      if (!this.handler) {
        throw new Error('Failed to create platform handler');
      }

      // Initialize the handler
      await this.handler.init();
      
      this.isInitialized = true;
      console.log('LocalBrain V2: Successfully initialized with', this.handler.platform, 'handler');
      
      // Set up global error handling
      this.setupErrorHandling();
      
    } catch (error) {
      console.error('LocalBrain V2: Initialization failed:', error);
      
      if (this.initializationAttempts < this.maxInitAttempts) {
        console.log('LocalBrain V2: Retrying initialization in 2 seconds...');
        setTimeout(() => this.init(), 2000);
      } else {
        console.error('LocalBrain V2: Max initialization attempts reached');
        this.showInitializationError();
      }
    }
  }

  async waitForDependencies() {
    const dependencies = [
      'BaseHandler',
      'PlatformFactory',
      'SelectorDetector'
    ];

    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    while (attempts < maxAttempts) {
      const missing = dependencies.filter(dep => !window[dep]);
      
      if (missing.length === 0) {
        console.log('LocalBrain V2: All dependencies loaded');
        return;
      }

      console.log('LocalBrain V2: Waiting for dependencies:', missing);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    throw new Error(`Dependencies not loaded: ${dependencies.filter(dep => !window[dep])}`);
  }

  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      if (event.error && event.error.stack && event.error.stack.includes('LocalBrain')) {
        console.error('LocalBrain V2: Runtime error:', event.error);
        this.handleRuntimeError(event.error);
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.stack && event.reason.stack.includes('LocalBrain')) {
        console.error('LocalBrain V2: Unhandled promise rejection:', event.reason);
        this.handleRuntimeError(event.reason);
      }
    });
  }

  handleRuntimeError(error) {
    // Attempt recovery for certain types of errors
    if (error.message.includes('selector') || error.message.includes('element')) {
      console.log('LocalBrain V2: Attempting to recover from selector error');
      this.handler?.selectorDetector?.clearCache();
    }

    // If handler becomes unresponsive, try to reinitialize
    if (error.message.includes('handler') && this.initializationAttempts < this.maxInitAttempts) {
      console.log('LocalBrain V2: Attempting handler recovery');
      setTimeout(() => this.init(), 1000);
    }
  }

  showInitializationError() {
    const notification = document.createElement('div');
    notification.className = 'localbrain-error-notification';
    notification.innerHTML = `
      <div>⚠️ LocalBrain failed to initialize</div>
      <div style="font-size: 12px; margin-top: 4px;">
        Platform: ${window.location.hostname} | 
        <a href="#" onclick="this.parentElement.parentElement.remove()" style="color: #fff;">Dismiss</a>
      </div>
    `;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      z-index: 10000;
      font-family: system-ui;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
    `;

    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  // Public API methods for backward compatibility
  async injectMemories() {
    if (!this.isInitialized || !this.handler) {
      console.warn('LocalBrain V2: Not initialized, cannot inject memories');
      return;
    }

    try {
      await this.handler.handleMemoryInjection();
    } catch (error) {
      console.error('LocalBrain V2: Memory injection failed:', error);
    }
  }

  async saveCurrentConversation() {
    if (!this.isInitialized || !this.handler) {
      console.warn('LocalBrain V2: Not initialized, cannot save conversation');
      return;
    }

    try {
      const messages = await this.handler.extractMessages();
      console.log(`LocalBrain V2: Saved ${messages.length} messages from current conversation`);
      return messages.length;
    } catch (error) {
      console.error('LocalBrain V2: Save conversation failed:', error);
      return 0;
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      platform: this.handler?.platform || 'unknown',
      platformType: this.handler?.platformType || 'unknown',
      attempts: this.initializationAttempts,
      handler: !!this.handler,
      memoryEngine: !!window.memoryEngine
    };
  }

  // Cleanup method
  cleanup() {
    if (this.handler && typeof this.handler.cleanup === 'function') {
      this.handler.cleanup();
    }
    this.handler = null;
    this.isInitialized = false;
    console.log('LocalBrain V2: Cleaned up');
  }
}

// Auto-initialize when content script loads
let localBrainInstance = null;

function initializeLocalBrain() {
  try {
    localBrainInstance = new LocalBrainV2();
    
    // Expose to global scope for debugging and external access
    window.localBrain = localBrainInstance;
    
  } catch (error) {
    console.error('LocalBrain V2: Failed to create instance:', error);
  }
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLocalBrain);
} else {
  initializeLocalBrain();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (localBrainInstance) {
    localBrainInstance.cleanup();
  }
});

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalBrainV2;
}