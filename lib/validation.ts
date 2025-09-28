import { toast } from "sonner";

/**
 * Validation rule interface
 */
export interface ValidationRule {
  field: string;
  value: any;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  firstError?: string;
}

/**
 * Generic validation function
 */
export const validateFields = (rules: ValidationRule[]): ValidationResult => {
  const errors: string[] = [];

  for (const rule of rules) {
    const { field, value, required, minLength, maxLength, pattern, custom, message } = rule;

    // Required field validation
    if (required) {
      if (value === null || value === undefined || value === "" || 
          (Array.isArray(value) && value.length === 0) ||
          (Array.isArray(value) && value.every(item => !item.trim()))) {
        errors.push(message || `${field} is required`);
        continue;
      }
    }

    // Skip other validations if field is empty and not required
    if (!required && (value === null || value === undefined || value === "")) {
      continue;
    }

    // Min length validation
    if (minLength !== undefined) {
      const length = Array.isArray(value) ? value.length : String(value).length;
      if (length < minLength) {
        errors.push(message || `${field} must be at least ${minLength} characters`);
        continue;
      }
    }

    // Max length validation
    if (maxLength !== undefined) {
      const length = Array.isArray(value) ? value.length : String(value).length;
      if (length > maxLength) {
        errors.push(message || `${field} must be no more than ${maxLength} characters`);
        continue;
      }
    }

    // Pattern validation
    if (pattern && !pattern.test(String(value))) {
      errors.push(message || `${field} format is invalid`);
      continue;
    }

    // Custom validation
    if (custom && !custom(value)) {
      errors.push(message || `${field} is invalid`);
      continue;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    firstError: errors[0],
  };
};

/**
 * Validate and show toast messages
 */
export const validateAndShowErrors = (rules: ValidationRule[]): boolean => {
  const result = validateFields(rules);
  
  if (!result.isValid) {
    if (result.errors.length === 1) {
      toast.error(result.firstError);
    } else {
      toast.error("Please fill in all required fields");
    }
    return false;
  }
  
  return true;
};

/**
 * Common validation rules factory
 */
export const createValidationRules = {
  required: (field: string, value: any, message?: string): ValidationRule => ({
    field,
    value,
    required: true,
    message: message || `Please fill in the ${field} field`,
  }),

  email: (field: string, value: string, message?: string): ValidationRule => ({
    field,
    value,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: message || `Please enter a valid email address`,
  }),

  minLength: (field: string, value: string, min: number, message?: string): ValidationRule => ({
    field,
    value,
    minLength: min,
    message: message || `${field} must be at least ${min} characters`,
  }),

  arrayNotEmpty: (field: string, value: any[], message?: string): ValidationRule => ({
    field,
    value: value.filter(item => String(item).trim()),
    custom: (filteredValue) => filteredValue.length > 0,
    message: message || `At least one ${field} must be provided`,
  }),

  selection: (field: string, value: number | string, message?: string): ValidationRule => ({
    field,
    value,
    custom: (val) => val !== 0 && val !== "" && val !== null && val !== undefined,
    message: message || `Please select a ${field}`,
  }),
};