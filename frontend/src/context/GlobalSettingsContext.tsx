/**
 * GlobalSettingsContext - Dark mode, distance units, and GPS settings
 * Provides app-wide state for user preferences
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GlobalSettings {
    darkMode: boolean;
    distanceUnit: 'km' | 'mi' | 'm' | 'ft' | 'nm';
    backgroundGps: boolean;
    notificationsEnabled: boolean;
}

interface GlobalSettingsContextType {
    settings: GlobalSettings;
    updateSetting: <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => Promise<void>;
    loading: boolean;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextType | null>(null);

const STORAGE_KEY = '@global_settings';

const DEFAULT_SETTINGS: GlobalSettings = {
    darkMode: true,
    distanceUnit: 'km',
    backgroundGps: false,
    notificationsEnabled: true,
};

export function GlobalSettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    // Load settings on mount
    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored) {
                    setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
                }
            } catch (e) {
                console.error('[Settings] Load failed:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const updateSetting = async <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
        try {
            const updated = { ...settings, [key]: value };
            setSettings(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('[Settings] Save failed:', e);
        }
    };

    return (
        <GlobalSettingsContext.Provider value={{ settings, updateSetting, loading }}>
            {children}
        </GlobalSettingsContext.Provider>
    );
}

export function useGlobalSettings() {
    const context = useContext(GlobalSettingsContext);
    if (!context) {
        throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
    }
    return context;
}
