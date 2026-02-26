/**
 * API Service — Complete client for the Territory Runner backend.
 */

import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import { GPSPoint, RunSession } from '../types/run';
import { getToken } from './authService';

// Web browser on same PC → localhost
// Physical phone on WiFi → your computer's IP address
const DEV_URL = Platform.OS === 'web'
    ? 'http://localhost:8000/api'
    : 'http://10.177.96.43:8000/api';

const BASE_URL = __DEV__ ? DEV_URL : 'https://api.territoryrunner.in/api';

const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export async function registerUser(token: string, username?: string, displayName?: string) {
    const { data } = await api.post('/auth/register', { token, username, display_name: displayName });
    return data;
}

export async function loginUser(token: string) {
    const { data } = await api.post('/auth/login', {}, { headers: { Authorization: `Bearer ${token}` } });
    return data;
}

export async function devRegister(username: string, displayName?: string, city?: string, state?: string) {
    const { data } = await api.post('/auth/dev-register', {
        username,
        display_name: displayName,
        city,
        state,
    });
    return data;
}

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

export async function getProfile(userId: string) {
    const { data } = await api.get(`/social/profile/${userId}`);
    return data;
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
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

export async function getIntegrationStatus(userId: string) {
    const { data } = await api.get(`/integrations/status/${userId}`);
    return data;
}

export async function disconnectProvider(userId: string, provider: string) {
    const { data } = await api.post('/integrations/disconnect', { user_id: userId, provider });
    return data;
}

export default api;
