/**
 * Generic localStorage utility functions with error handling
 */

export interface LocalStorageUtils {
  save: <T>(key: string, data: T) => boolean;
  load: <T>(key: string, defaultValue?: T) => T | null;
  remove: (key: string) => boolean;
  clear: () => boolean;
  exists: (key: string) => boolean;
}

/**
 * Check if localStorage is available
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, 'test');
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Save data to localStorage
 */
const save = <T>(key: string, data: T): boolean => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return false;
  }

  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem(key, serializedData);
    console.log(`✅ Saved to localStorage [${key}]:`, data);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save to localStorage [${key}]:`, error);
    return false;
  }
};

/**
 * Load data from localStorage
 */
const load = <T>(key: string, defaultValue?: T): T | null => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return defaultValue || null;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      console.log(`📭 No data found in localStorage [${key}]`);
      return defaultValue || null;
    }

    const parsedData = JSON.parse(item) as T;
    console.log(`✅ Loaded from localStorage [${key}]:`, parsedData);
    return parsedData;
  } catch (error) {
    console.error(`❌ Failed to load from localStorage [${key}]:`, error);
    return defaultValue || null;
  }
};

/**
 * Remove specific item from localStorage
 */
const remove = (key: string): boolean => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return false;
  }

  try {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed from localStorage [${key}]`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to remove from localStorage [${key}]:`, error);
    return false;
  }
};

/**
 * Clear all localStorage data
 */
const clear = (): boolean => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return false;
  }

  try {
    localStorage.clear();
    console.log('🧹 Cleared all localStorage data');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear localStorage:', error);
    return false;
  }
};

/**
 * Check if a key exists in localStorage
 */
const exists = (key: string): boolean => {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  return localStorage.getItem(key) !== null;
};

/**
 * Main localStorage utility object
 */
export const localStorageUtils: LocalStorageUtils = {
  save,
  load,
  remove,
  clear,
  exists,
};

/**
 * Hook for using localStorage in React components
 */
export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const saveValue = (value: T) => localStorageUtils.save(key, value);
  const loadValue = () => localStorageUtils.load(key, defaultValue);
  const removeValue = () => localStorageUtils.remove(key);
  const hasValue = () => localStorageUtils.exists(key);

  return {
    save: saveValue,
    load: loadValue,
    remove: removeValue,
    exists: hasValue,
  };
};
