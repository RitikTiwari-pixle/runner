/**
 * Auth Service — Firebase Authentication for React Native
 *
 * Handles phone/email auth via Firebase and stores JWT
 * for authenticating with our backend API.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    USER_ID: '@territory_runner/user_id',
    TOKEN: '@territory_runner/token',
    USERNAME: '@territory_runner/username',
};

let _userId: string | null = null;
let _token: string | null = null;

/** Load stored auth state from AsyncStorage on app start */
export async function loadAuthState(): Promise<{
    userId: string | null;
    token: string | null;
}> {
    try {
        _userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        _token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (e) {
        console.warn('[Auth] Failed to load auth state:', e);
    }
    return { userId: _userId, token: _token };
}

/** Save auth state after login/register */
export async function saveAuthState(userId: string, token: string, username?: string): Promise<void> {
    _userId = userId;
    _token = token;
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
        if (username) {
            await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username);
        }
    } catch (e) {
        console.warn('[Auth] Failed to save auth state:', e);
    }
}

/** Clear auth state on logout */
export async function clearAuthState(): Promise<void> {
    _userId = null;
    _token = null;
    try {
        await AsyncStorage.multiRemove([
            STORAGE_KEYS.USER_ID,
            STORAGE_KEYS.TOKEN,
            STORAGE_KEYS.USERNAME,
        ]);
    } catch (e) {
        console.warn('[Auth] Failed to clear auth state:', e);
    }
}

/** Get current user ID (in-memory cache) */
export function getUserId(): string | null {
    return _userId;
}

/** Get current token (in-memory cache) */
export function getToken(): string | null {
    return _token;
}

/** Check if user is logged in */
export function isAuthenticated(): boolean {
    return _userId !== null && _token !== null;
}
