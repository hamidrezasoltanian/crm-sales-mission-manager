/**
 * Message handlers for Telegram bot
 * Handles conversation messages and text inputs
 */

export class MessageHandlers {
  constructor(bot, conversations, services) {
    this.bot = bot;
    this.conversations = conversations;
    this.services = services;
  }

  /**
   * Register all message handlers
   */
  registerHandlers() {
    this.bot.on('message', async (msg) => {
      // Skip commands (handled by onText)
      if (msg.text && msg.text.startsWith('/')) {
        return;
      }

      await this.handleMessage(msg);
    });
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const conversation = this.conversations.get(chatId);

    if (!conversation) {
      return; // No active conversation
    }

    // Route to specific handlers based on conversation step
    switch (conversation.step) {
      case 'province_contact_note':
        await this.handleProvinceContactNote(msg, conversation);
        break;
      case 'province_center_search':
        await this.handleProvinceCenterSearch(msg, conversation);
        break;
      // Add more message handlers here...
      default:
        // Unknown step
        break;
    }
  }

  async handleProvinceContactNote(msg, conversation) {
    // Implementation will be moved here
  }

  async handleProvinceCenterSearch(msg, conversation) {
    // Implementation will be moved here
  }
}

