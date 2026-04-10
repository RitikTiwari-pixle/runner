/**
 * API Service - Complete client for the Territory Runner backend.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { NativeModules, Platform } from 'react-native';
import { GPSPoint, RunSession } from '../types/run';
import { getToken } from './authService';

function normalizeApiUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function extractHost(value?: string | null): string | null {
    const raw = value?.trim();
    if (!raw) return null;

    const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`;
    const match = withScheme.match(/^[a-z]+:\/\/([^/:]+)/i);
    return match?.[1] ?? null;
}

function isLoopbackHost(host: string): boolean {
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
}

function isTunnelHost(host: string): boolean {
    const lower = host.toLowerCase();
    return (
        lower.endsWith('.expo.dev')
        || lower.endsWith('.exp.direct')
        || lower.includes('ngrok')
        || lower.includes('trycloudflare')
    );
}

function resolveDevHost(): string | null {
    const candidates: string[] = [];
    const addHost = (value?: string | null) => {
        const host = extractHost(value);
        if (host && !candidates.includes(host)) {
            candidates.push(host);
        }
    };

    try {
        if (Platform.OS !== 'web' && NativeModules?.SourceCode?.scriptURL) {
            addHost(NativeModules.SourceCode.scriptURL);
        }
    } catch (e) {
        // NativeModules may not be available in pure web context
        console.debug('[API] NativeModules access failed (web context):', e);
    }

    try {
        const constants = NativeModules?.DevSettings?.getConstants?.();
        addHost(constants?.packagerConnectionSettings?.debuggerHost);
    } catch {
        // no-op
    }

    try {
        // Optional runtime source for Expo Go host details.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const expoConstants = require('expo-constants').default;
        addHost(expoConstants?.expoConfig?.hostUri);
        addHost(expoConstants?.manifest2?.extra?.expoClient?.hostUri);
        addHost(expoConstants?.manifest?.debuggerHost);
    } catch {
        // no-op
    }

    // Prioritize non-loopback, non-tunnel hosts for LAN connections (physical device on same network)
    for (const host of candidates) {
        if (!isLoopbackHost(host) && !isTunnelHost(host)) {
            console.log('[API] Using LAN host for physical device:', host);
            return host;
        }
    }

    // If no LAN host found, check for tunnel hosts (good for remote dev)
    const tunnelHost = candidates.find(isTunnelHost);
    if (tunnelHost) {
        console.log('[API] Using tunnel host:', tunnelHost);
        return tunnelHost;
    }

    // Last resort: any candidate (usually localhost)
    if (candidates.length > 0) {
        console.log('[API] Using fallback host:', candidates[0]);
        return candidates[0];
    }

    return null;
}

function inferExpoDevApiUrl(): string {
    const host = resolveDevHost();
    if (host && !isLoopbackHost(host) && !isTunnelHost(host)) {
        return `http://${host}:8000/api`;
    }

    // Fallback likely for Android emulator.
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8000/api';
    }
    return 'http://localhost:8000/api';
}

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

// On web, the browser can always reach the backend via localhost directly.
// If EXPO_PUBLIC_API_URL was set to a LAN IP (e.g. for Expo Go on phone),
// rewrite it to localhost so the web build doesn't break.
function resolveWebApiUrl(raw: string): string {
    try {
        const url = new URL(raw.trim().replace(/\/+$/, ''));
        if (!isLoopbackHost(url.hostname)) {
            return `http://localhost:${url.port || 8000}/api`;
        }
    } catch {
        // fallthrough
    }
    return normalizeApiUrl(raw);
}

// Priority:
// 1) EXPO_PUBLIC_API_URL  (web: rewritten to localhost if LAN IP)
// 2) localhost (web fallback)
// 3) inferred host from Expo bundler URL / emulator fallback (native)
const DEV_URL = ENV_API_URL
    ? (Platform.OS === 'web' ? resolveWebApiUrl(ENV_API_URL) : normalizeApiUrl(ENV_API_URL))
    : (Platform.OS === 'web' ? 'http://localhost:8000/api' : inferExpoDevApiUrl());

// Allow production API URL to be overridden via environment variable
const PROD_URL = process.env.EXPO_PUBLIC_API_URL || 'https://runner-production-02d9.up.railway.app';
export const API_BASE_URL = __DEV__ ? DEV_URL : normalizeApiUrl(PROD_URL);

if (__DEV__) {
    // Helps diagnose Expo Go "Network Error" quickly in Metro logs.
    console.log(`[API] base URL: ${API_BASE_URL}`);
}

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
    const err = error as AxiosError<{ detail?: string }>;
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
        return detail;
    }

    if (err?.code === 'ECONNABORTED') {
        return `Server timeout at ${API_BASE_URL}.`;
    }

    if (err?.message === 'Network Error') {
        return `Cannot connect to backend (${API_BASE_URL}). If using Expo Go on phone, set EXPO_PUBLIC_API_URL=http://<your-laptop-ip>:8000/api and restart Expo in LAN mode.`;
    }

    if (typeof err?.message === 'string' && err.message.trim()) {
        return err.message;
    }

    return fallback;
}

export async function registerUser(token: string, username?: string, displayName?: string) {
    const { data } = await api.post('/auth/register', { token, username, display_name: displayName });
    return data;
}

export async function loginUser(token: string) {
    const { data } = await api.post('/auth/login', {}, { headers: { Authorization: `Bearer ${token}` } });
    return data;
}

export async function devRegister(username: string, displayName?: string, city?: string, state?: string, email?: string) {
    const { data } = await api.post('/auth/dev-register', {
        username,
        display_name: displayName,
        city,
        state,
        email,
    });
    return data;
}

// Local Authentication (Email/Username + Password + OTP)
export type OtpPurpose = 'signup' | 'password_reset';

export interface LocalRegisterInitResponse {
    user_id: string;
    username: string;
    email: string;
    requires_verification: boolean;
    message: string;
}

export interface LocalAuthResponse {
    token: string;
    user_id: string;
    username: string;
    email?: string | null;
    email_verified?: boolean | null;
    level?: number | null;
    total_distance_m?: number | null;
}

export interface LocalMessageResponse {
    message: string;
}

export async function registerLocal(
    email: string,
    username: string,
    password: string,
    displayName?: string,
    city?: string,
    state?: string,
): Promise<LocalRegisterInitResponse> {
    const { data } = await api.post('/auth/local/register', {
        email,
        username,
        password,
        display_name: displayName,
        city,
        state,
    });
    return data;
}

export async function loginLocal(identifier: string, password: string): Promise<LocalAuthResponse> {
    const { data } = await api.post('/auth/local/login', {
        identifier,
        password,
    });
    return data;
}

export async function requestPasswordResetOtp(email: string): Promise<LocalMessageResponse> {
    const { data } = await api.post('/auth/local/forgot-password', { email });
    return data;
}

export async function verifyLocalOtp(
    email: string,
    otpCode: string,
    purpose: OtpPurpose,
    newPassword?: string,
) {
    const payload: Record<string, string> = {
        email,
        otp_code: otpCode,
        purpose,
    };
    if (newPassword) {
        payload.new_password = newPassword;
    }
    const { data } = await api.post('/auth/local/verify-otp', payload);
    return data;
}

export async function resendLocalOtp(email: string, purpose: OtpPurpose): Promise<LocalMessageResponse> {
    const { data } = await api.post('/auth/local/resend-otp', { email, purpose });
    return data;
}

export async function googleLogin(idToken: string): Promise<LocalAuthResponse> {
    const { data } = await api.post('/auth/google/login', {
        id_token: idToken,
    });
    return data;
}

// Runs + Social
export async function startRun(userId: string): Promise<RunSession> {
    const { data } = await api.post('/runs/start', { user_id: userId });
    return data;
}

export async function syncPoints(runId: string, points: GPSPoint[]): Promise<void> {
    if (points.length === 0) return;
    await api.post(`/runs/${runId}/points`, { points });
}

export async function finishRun(runId: string, difficulty?: string, notes?: string): Promise<RunSession> {
    const { data } = await api.post(`/runs/${runId}/finish`, { difficulty, notes });
    return data;
}

export async function getRun(runId: string): Promise<RunSession> {
    const { data } = await api.get(`/runs/${runId}`);
    return data;
}

export async function getUserRuns(userId: string, limit = 20, offset = 0): Promise<RunSession[]> {
    const { data } = await api.get(`/runs/user/${userId}`, { params: { limit, offset } });
    return data;
}

export async function reportSuspiciousRun(runId: string, reason = 'suspicious_activity'): Promise<void> {
    await api.post(`/runs/${runId}/report`, { reason });
}

export interface TerritoryMapResponse {
    id: string;
    owner_id: string;
    run_id: string;
    area_sqm: number;
    captured_at: string;
    stolen_from_id?: string | null;
    is_active: boolean;
    coordinates: number[][] | null;
}

export async function getTerritoriesInArea(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
): Promise<TerritoryMapResponse[]> {
    const { data } = await api.get('/territories/area', {
        params: {
            min_lat: minLat,
            min_lng: minLng,
            max_lat: maxLat,
            max_lng: maxLng,
        },
    });
    return data;
}

export async function getProfile(userId: string) {
    const { data } = await api.get(`/social/profile/${userId}`);
    return data;
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
    const { data } = await api.put(`/social/profile/${userId}`, updates);
    return data;
}

export async function searchUsers(query: string, limit = 20) {
    const { data } = await api.get('/social/search', { params: { q: query, limit } });
    return data;
}

export async function followUser(followerId: string, followingId: string) {
    const { data } = await api.post('/social/follow', { follower_id: followerId, following_id: followingId });
    return data;
}

export async function unfollowUser(followerId: string, followingId: string) {
    const { data } = await api.post('/social/unfollow', { follower_id: followerId, following_id: followingId });
    return data;
}

export async function getFollowers(userId: string) {
    const { data } = await api.get(`/social/followers/${userId}`);
    return data;
}

export async function getFollowing(userId: string) {
    const { data } = await api.get(`/social/following/${userId}`);
    return data;
}

export async function checkIsFollowing(followerId: string, followingId: string) {
    const { data } = await api.get('/social/is-following', { params: { follower_id: followerId, following_id: followingId } });
    return data.is_following;
}

export async function getPersonalFeed(userId: string, limit = 30, offset = 0) {
    const { data } = await api.get(`/social/feed/personal/${userId}`, { params: { limit, offset } });
    return data;
}

export async function getFriendsFeed(userId: string, limit = 30, offset = 0) {
    const { data } = await api.get(`/social/feed/friends/${userId}`, { params: { limit, offset } });
    return data;
}

export async function getLeaderboard(board = 'territory', city?: string, state?: string, limit = 50) {
    const { data } = await api.get('/social/leaderboard', { params: { board, city, state, limit } });
    return data;
}

export async function getFriendsLeaderboard(userId: string, board = 'territory') {
    const { data } = await api.get(`/social/leaderboard/friends/${userId}`, { params: { board } });
    return data;
}

export async function getProgressionStatus(userId: string) {
    const { data } = await api.get(`/progression/status/${userId}`);
    return data;
}

export async function getActiveChallenges(city?: string, state?: string) {
    const { data } = await api.get('/progression/challenges', { params: { city, state } });
    return data;
}

export async function joinChallenge(userId: string, challengeId: string) {
    const { data } = await api.post('/progression/challenges/join', { user_id: userId, challenge_id: challengeId });
    return data;
}

export async function getUserChallenges(userId: string) {
    const { data } = await api.get(`/progression/challenges/user/${userId}`);
    return data;
}

export default api;
