/**
 * Helper functions for center-related operations
 */

import { Center } from '../../models/Center.js';
import { Personnel } from '../../models/Personnel.js';
import { formatHelpers } from './formatHelpers.js';

export const centerHelpers = {
  /**
   * Get formatted center list for display
   */
  formatCenterList(centers, page = 0, centersPerPage = 10) {
    const centersToShow = centers.slice(page * centersPerPage, (page + 1) * centersPerPage);
    const totalPages = Math.ceil(centers.length / centersPerPage);

    let message = '';
    centersToShow.forEach((center, index) => {
      const globalIndex = page * centersPerPage + index + 1;
      const centerName = formatHelpers.escapeMarkdown(center.name || 'نامشخص');
      const city = formatHelpers.escapeMarkdown(center.city || 'نامشخص');
      const typeEmoji = formatHelpers.getTypeEmoji(center.type);
      const typeLabel = formatHelpers.getTypeLabel(center.type);
      const responsibleName = formatHelpers.escapeMarkdown(center.responsiblePersonnelName || '');

      message += `${globalIndex}. ${typeEmoji} *${centerName}*\n`;
      message += `   📍 ${city}`;
      if (center.type) {
        message += ` | ${typeLabel}`;
      }
      if (responsibleName) {
        message += `\n   👤 مسئول: ${responsibleName}`;
      }
      message += `\n\n`;
    });

    return { message, centersToShow, totalPages };
  },

  /**
   * Create center button text for inline keyboard
   */
  createCenterButtonText(center) {
    const centerName = formatHelpers.escapeMarkdown(center.name || 'مرکز');
    const city = formatHelpers.escapeMarkdown(center.city || '');
    const responsibleName = formatHelpers.escapeMarkdown(center.responsiblePersonnelName || '');
    const typeEmoji = formatHelpers.getTypeEmoji(center.type);

    let buttonText = `📞 ${centerName}`;

    if (center.type) {
      buttonText += ` ${typeEmoji}`;
    }

    if (city) {
      const cityLabel = city.length > 8 ? city.substring(0, 8) + '...' : city;
      buttonText += `\n  📍 ${cityLabel}`;
    }

    if (responsibleName) {
      const responsibleLabel = responsibleName.length > 10
        ? responsibleName.substring(0, 10) + '...'
        : responsibleName;
      buttonText += ` 👤 ${responsibleLabel}`;
    }

    return buttonText;
  },

  /**
   * Get center details message
   */
  getCenterDetailsMessage(center) {
    const centerName = formatHelpers.escapeMarkdown(center.name || 'نامشخص');
    const city = formatHelpers.escapeMarkdown(center.city || 'نامشخص');
    const address = formatHelpers.escapeMarkdown(center.address || 'نامشخص');
    const typeLabel = formatHelpers.getTypeLabel(center.type);
    const responsibleName = formatHelpers.escapeMarkdown(center.responsiblePersonnelName || 'بدون مسئول');

    return `🏢 *${centerName}*\n\n` +
      `📍 شهر: ${city}\n` +
      `📍 آدرس: ${address}\n` +
      `📊 نوع: ${typeLabel}\n` +
      `👤 مسئول: ${responsibleName}`;
  }
};

