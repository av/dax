// Input validation utilities

export const validators = {
  // Required field validator
  required: (value: any): string | null => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return 'This field is required';
    }
    return null;
  },

  // Email validator
  email: (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Invalid email address';
  },

  // URL validator
  url: (value: string): string | null => {
    if (!value) return null;
    try {
      const parsed = new URL(value);
      // Only allow safe protocols for security
      const allowedProtocols = ['http:', 'https:', 'ws:', 'wss:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        return `URL protocol must be one of: ${allowedProtocols.map(p => p.replace(':', '')).join(', ')}`;
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  },

  // Minimum length validator
  minLength: (min: number) => (value: string): string | null => {
    if (!value) return null;
    return value.length >= min ? null : `Must be at least ${min} characters`;
  },

  // Maximum length validator
  maxLength: (max: number) => (value: string): string | null => {
    if (!value) return null;
    return value.length <= max ? null : `Must be at most ${max} characters`;
  },

  // Number range validator
  range: (min: number, max: number) => (value: number): string | null => {
    if (value === null || value === undefined) return null;
    if (value < min || value > max) {
      return `Must be between ${min} and ${max}`;
    }
    return null;
  },

  // Port number validator
  port: (value: number): string | null => {
    if (value === null || value === undefined) return null;
    if (value < 1 || value > 65535) {
      return 'Port must be between 1 and 65535';
    }
    return null;
  },

  // Path validator (basic check)
  path: (value: string): string | null => {
    if (!value) return null;
    // Basic check for invalid characters in paths
    const invalidChars = /[<>"|?*\x00-\x1F]/;
    if (invalidChars.test(value)) {
      return 'Invalid path characters';
    }
    // Check for path traversal attempts
    if (value.includes('..')) {
      return 'Path traversal patterns (..) are not allowed';
    }
    return null;
  },

  // JSON validator
  json: (value: string): string | null => {
    if (!value || !value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch {
      return 'Invalid JSON format';
    }
  },

  // API key validator (basic format check)
  apiKey: (value: string): string | null => {
    if (!value) return null;
    // Check for minimum length and no spaces
    if (value.length < 10) {
      return 'API key seems too short';
    }
    if (/\s/.test(value)) {
      return 'API key should not contain spaces';
    }
    return null;
  },

  // Temperature validator (for AI models)
  temperature: (value: number): string | null => {
    if (value === null || value === undefined) return null;
    if (value < 0 || value > 2) {
      return 'Temperature must be between 0 and 2';
    }
    return null;
  },

  // Positive integer validator
  positiveInteger: (value: number): string | null => {
    if (value === null || value === undefined) return null;
    if (!Number.isInteger(value) || value <= 0) {
      return 'Must be a positive integer';
    }
    return null;
  },

  // Theme validator
  theme: (value: string): string | null => {
    const validThemes = ['light', 'dark', 'system'];
    if (!value) return 'Theme is required';
    if (!validThemes.includes(value)) {
      return 'Theme must be light, dark, or system';
    }
    return null;
  },

  // Language code validator
  languageCode: (value: string): string | null => {
    if (!value) return 'Language is required';
    // Basic ISO 639-1 language code format (2 letters)
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(value)) {
      return 'Invalid language code format';
    }
    return null;
  },

  // Hotkey validator
  hotkey: (value: string): string | null => {
    if (!value) return null;
    
    // Split into modifiers and key
    const parts = value.split('+');
    if (parts.length < 2) {
      return 'Hotkey must include at least one modifier and a key';
    }
    
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);
    
    // Validate modifiers (case-insensitive)
    const validModifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
    const normalizedModifiers: string[] = [];
    
    for (const mod of modifiers) {
      // Normalize to title case for comparison
      const normalized = mod.charAt(0).toUpperCase() + mod.slice(1).toLowerCase();
      if (!validModifiers.includes(normalized)) {
        return `Invalid modifier: ${mod}. Use Ctrl, Alt, Shift, or Meta`;
      }
      normalizedModifiers.push(normalized);
    }
    
    // Check for duplicate modifiers
    const uniqueModifiers = new Set(normalizedModifiers);
    if (uniqueModifiers.size !== normalizedModifiers.length) {
      return 'Duplicate modifiers are not allowed';
    }
    
    // Validate key (alphanumeric or special keys)
    if (!/^[A-Za-z0-9]$/.test(key)) {
      return 'Key must be a single letter or number';
    }
    
    return null;
  },

  // Backup interval validator (in milliseconds)
  backupInterval: (value: number): string | null => {
    if (value === null || value === undefined) return null;
    // Minimum 5 minutes (300000ms), maximum 24 hours (86400000ms)
    const minInterval = 300000; // 5 minutes
    const maxInterval = 86400000; // 24 hours
    if (value < minInterval) {
      return 'Backup interval must be at least 5 minutes';
    }
    if (value > maxInterval) {
      return 'Backup interval cannot exceed 24 hours';
    }
    return null;
  },

  // Directory path validator
  directoryPath: (value: string): string | null => {
    if (!value) return 'Directory path is required';
    // Check for invalid characters in paths
    const invalidChars = /[<>"|?*\x00-\x1F]/;
    if (invalidChars.test(value)) {
      return 'Path contains invalid characters';
    }
    // Check for path traversal attempts
    if (value.includes('..')) {
      return 'Path traversal patterns (..) are not allowed';
    }
    return null;
  },
};

// Validation helper that runs multiple validators
export function validate(
  value: any,
  validatorFns: Array<(value: any) => string | null>
): string | null {
  for (const validator of validatorFns) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
}

// Form field validation helper
export function validateField(
  _fieldName: string,
  value: any,
  rules: Array<(value: any) => string | null>
): { isValid: boolean; error: string | null } {
  const error = validate(value, rules);
  return {
    isValid: error === null,
    error,
  };
}

// Validate entire form
export function validateForm<T extends Record<string, any>>(
  values: T,
  rules: Record<keyof T, Array<(value: any) => string | null>>
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  let isValid = true;

  for (const [field, fieldRules] of Object.entries(rules)) {
    const error = validate(values[field], fieldRules as any);
    if (error) {
      errors[field as keyof T] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

// Sanitization utilities
export const sanitizers = {
  // Trim whitespace
  trim: (value: string): string => value.trim(),

  // Remove HTML tags (recursive to handle nested tags properly)
  stripHtml: (value: string): string => {
    let result = value;
    let previous = '';
    // Keep removing tags until no more tags are found
    while (result !== previous) {
      previous = result;
      result = result.replace(/<[^>]*>/g, '');
    }
    return result;
  },

  // Escape HTML for display
  escapeHtml: (value: string): string => {
    const htmlEscapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#96;',
    };
    return value.replace(/[&<>"'/`]/g, (char) => htmlEscapeMap[char]);
  },

  // Remove non-alphanumeric characters
  alphanumeric: (value: string): string => {
    return value.replace(/[^a-zA-Z0-9]/g, '');
  },

  // Sanitize path (remove dangerous characters)
  sanitizePath: (value: string): string => {
    // Remove null bytes and control characters
    let sanitized = value.replace(/[\x00-\x1F\x7F]/g, '');
    // Remove dangerous path traversal patterns
    sanitized = sanitized.replace(/\.\./g, '');
    return sanitized;
  },

  // Sanitize for use in URLs
  urlSafe: (value: string): string => {
    return encodeURIComponent(value);
  },

  // Normalize whitespace
  normalizeWhitespace: (value: string): string => {
    return value.replace(/\s+/g, ' ').trim();
  },
};
