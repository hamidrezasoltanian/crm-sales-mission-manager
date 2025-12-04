/**
 * Helper functions for formatting and displaying data
 */

export const formatHelpers = {
  // Escape Markdown special characters
  escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/[*_`\[\]()]/g, '');
  },

  // Get status label in Persian
  getStatusLabel(status) {
    const labels = {
      'pending': 'در انتظار تایید',
      'approved': 'تایید شده',
      'in-progress': 'در حال انجام',
      'completed': 'تکمیل شده',
      'rejected': 'رد شده',
      'cancelled': 'لغو شده'
    };
    return labels[status] || status;
  },

  // Get type emoji
  getTypeEmoji(type) {
    const emojis = {
      'lead': '🔵',
      'opportunity': '🟢',
      'customer': '🟡',
      'old_customer': '🟠'
    };
    return emojis[type] || '⚪';
  },

  // Get type label in Persian
  getTypeLabel(type) {
    const labels = {
      'lead': 'سرنخ',
      'opportunity': 'فرصت',
      'customer': 'مشتری',
      'old_customer': 'قدیمی'
    };
    return labels[type] || type;
  },

  // Format number with Persian locale
  formatNumber(value) {
    if (value === null || value === undefined) return '0';
    return Number(value).toLocaleString('fa-IR');
  },

  // Format currency
  formatCurrency(value) {
    return `${this.formatNumber(value)} تومان`;
  }
};

