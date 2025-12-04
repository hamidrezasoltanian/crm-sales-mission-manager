/**
 * Utility functions for parsing request data
 */

/**
 * Parse tagged personnel IDs from various formats
 * @param {any} value - Can be array, JSON string, or comma-separated string
 * @returns {number[]} Array of valid personnel IDs
 */
export function parseTaggedPersonnelIds(value) {
  // If already an array, parse and filter
  if (Array.isArray(value)) {
    return value
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && id > 0);
  }
  
  // If string, try to parse
  if (typeof value === 'string' && value.trim()) {
    // Try JSON parsing first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id) && id > 0);
      }
    } catch {
      // Not JSON, continue to comma-separated parsing
    }
    
    // Parse as comma-separated string
    return value
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);
  }
  
  // Default: empty array
  return [];
}

/**
 * Parse integer ID from request parameter
 * @param {string|number} value - ID value
 * @param {string} fieldName - Field name for error message
 * @returns {number} Parsed ID
 * @throws {Error} If ID is invalid
 */
export function parseId(value, fieldName = 'id') {
  const id = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (!id || isNaN(id) || id <= 0) {
    throw new Error(`شناسه ${fieldName} نامعتبر است`);
  }
  
  return id;
}

