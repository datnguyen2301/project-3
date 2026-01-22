"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getSettings, updateSettings, DEFAULT_SETTINGS, type UserSettings } from "@/services/settingsApi";
import { getAuthToken } from "@/services/authApi";

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Apply theme to document
function applyTheme(theme: 'dark' | 'light', themeColor: string) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Apply theme class
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
  
  // Apply theme color as CSS variable
  root.style.setProperty('--theme-color', themeColor);
  root.style.setProperty('--theme-color-rgb', hexToRgb(themeColor));
}

// Convert hex to RGB for rgba() usage
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }
  return '234, 179, 8'; // Default yellow
}

// Apply language to document
function applyLanguage(language: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  const refreshSettings = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setSettings(DEFAULT_SETTINGS);
      applyTheme(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.themeColor);
      applyLanguage(DEFAULT_SETTINGS.language);
      setIsLoading(false);
      return;
    }

    try {
      const fetchedSettings = await getSettings();
      setSettings(fetchedSettings);
      applyTheme(fetchedSettings.theme, fetchedSettings.themeColor);
      applyLanguage(fetchedSettings.language);
    } catch (error) {
      console.error('[SettingsContext] Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  // Listen for login/logout events
  useEffect(() => {
    const handleLogin = () => {
      refreshSettings();
    };

    const handleLogout = () => {
      setSettings(DEFAULT_SETTINGS);
      applyTheme(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.themeColor);
      applyLanguage(DEFAULT_SETTINGS.language);
    };

    window.addEventListener('user-login', handleLogin);
    window.addEventListener('session-expired', handleLogout);

    return () => {
      window.removeEventListener('user-login', handleLogin);
      window.removeEventListener('session-expired', handleLogout);
    };
  }, [refreshSettings]);

  // Update a single setting
  const updateSetting = useCallback(async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    // Optimistic update
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Apply theme/language immediately
    if (key === 'theme' || key === 'themeColor') {
      applyTheme(
        key === 'theme' ? value as 'dark' | 'light' : newSettings.theme,
        key === 'themeColor' ? value as string : newSettings.themeColor
      );
    }
    if (key === 'language') {
      applyLanguage(value as string);
    }

    // Save to backend
    const result = await updateSettings({ [key]: value });
    
    if (!result.success) {
      // Revert on failure
      console.error('[SettingsContext] Failed to save setting:', result.error);
      setSettings(settings);
    }
  }, [settings]);

  const value: SettingsContextType = {
    settings,
    isLoading,
    updateSetting,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
