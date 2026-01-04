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
      new URL(value);
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
    return invalidChars.test(value) ? 'Invalid path characters' : null;
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
  fieldName: string,
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

  // Remove HTML tags
  stripHtml: (value: string): string => {
    return value.replace(/<[^>]*>/g, '');
  },

  // Escape HTML for display
  escapeHtml: (value: string): string => {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
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
