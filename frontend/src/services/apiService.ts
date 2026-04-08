/**
 * API Service - Complete client for the Territory Runner backend.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { GPSPoint, RunSession } from '../types/run';
import { getToken } from './authService';

function normalizeApiUrl(rawUrl: string): string {
    let trimmed = rawUrl.trim().replace(/\/+$/, '');
    if (!/^[a-z]+:\/\//i.test(trimmed)) {
        const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(trimmed);
        trimmed = `${isLocalHost ? 'http' : 'https'}://${trimmed}`;
    }
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEV_FALLBACK_API_URL = 'http://localhost:8000';
const PROD_FALLBACK_API_URL = 'https://your-backend.up.railway.app';

const resolvedBaseUrl = ENV_API_URL && ENV_API_URL.length > 0
    ? ENV_API_URL
    : (__DEV__ ? DEV_FALLBACK_API_URL : PROD_FALLBACK_API_URL);

if (!__DEV__ && !ENV_API_URL) {
    console.error('[API] EXPO_PUBLIC_API_URL is not set. Falling back to placeholder production URL.');
}

export const API_BASE_URL = normalizeApiUrl(resolvedBaseUrl);

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
        return `Cannot connect to backend (${API_BASE_URL}). Verify EXPO_PUBLIC_API_URL points to your deployed backend URL.`;
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
