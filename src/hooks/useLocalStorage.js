import { useState, useEffect, useCallback, useRef } from "react";
import { safeJsonParse } from "../utils/safeJsonParse.js";

const useLocalStorage = (key, initialValue) => {
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const isInternalWrite = useRef(false);

  const readValue = useCallback(() => {
    if (typeof window === "undefined") return initialValueRef.current;

    try {
      const item = window.localStorage.getItem(key);
      return safeJsonParse(item, initialValueRef.current);
    } catch (error) {
      console.warn(`useLocalStorage: error reading key "${key}":`, error);
      return initialValueRef.current;
    }
  }, [key]);

  const [storedValue, setStoredValue] = useState(readValue);

  const notifyLocalStorageListeners = useCallback(() => {
    try {
      isInternalWrite.current = true;
      window.dispatchEvent(new CustomEvent("local-storage", { detail: { key } }));
    } catch {
      isInternalWrite.current = false;
    }
  }, [key]);

  const setValue = useCallback(
    (value) => {
      setStoredValue((currentVal) => {
        const newValue = value instanceof Function ? value(currentVal) : value;

        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          }
        } catch (error) {
          console.warn(`useLocalStorage: error setting key "${key}":`, error);
        }

        notifyLocalStorageListeners();
        return newValue;
      });
    },
    [key, notifyLocalStorageListeners]
  );

  const removeValue = useCallback(() => {
    setStoredValue(initialValueRef.current);

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`useLocalStorage: error removing key "${key}":`, error);
    }

    notifyLocalStorageListeners();
  }, [key, notifyLocalStorageListeners]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event) => {
      if (isInternalWrite.current) {
        isInternalWrite.current = false;
        return;
      }

      if (event.key === key || (event.type === "local-storage" && event.detail?.key === key)) {
        setStoredValue(readValue());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("local-storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("local-storage", handleStorageChange);
    };
  }, [key, readValue]);

  return [storedValue, setValue, removeValue];
};

export default useLocalStorage;

export const isLocalStorageAvailable = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;

    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};
