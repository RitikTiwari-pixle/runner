/**
 * useRunTracker (Web fallback) — Run lifecycle hook using browser Geolocation API.
 *
 * State machine: idle → running ↔ paused → finished
 *
 * On web, we use navigator.geolocation instead of expo-location.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GPSPoint, RunStatus, Coordinate, RunMetrics } from '../types/run';
import { haversineDistance } from '../utils/geo';
import {
    startForegroundTracking,
    startBackgroundTracking,
    stopBackgroundTracking,
    flushBuffer,
    setOnPointCallback,
    recoverBuffer,
} from '../services/locationService';
import * as api from '../services/apiService';

const SYNC_INTERVAL_MS = 15_000;

export interface UseRunTrackerReturn {
    status: RunStatus;
    route: Coordinate[];
    metrics: RunMetrics;
    currentLocation: Coordinate | null;
    startRun: () => Promise<void>;
    pauseRun: () => void;
    resumeRun: () => void;
    stopRun: (difficulty?: string, notes?: string) => Promise<void>;
}

export function useRunTracker(userId: string): UseRunTrackerReturn {
    const [status, setStatus] = useState<RunStatus>('idle');
    const [route, setRoute] = useState<Coordinate[]>([]);
    const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
    const [metrics, setMetrics] = useState<RunMetrics>({
        duration_s: 0,
        distance_m: 0,
        avg_pace_s_per_km: 0,
        max_speed_mps: 0,
    });

    const runIdRef = useRef<string | null>(null);
    const subscriptionRef = useRef<{ remove: () => void } | null>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedDurationRef = useRef<number>(0);
    const totalDistanceRef = useRef<number>(0);
    const lastCoordRef = useRef<Coordinate | null>(null);
    const maxSpeedRef = useRef<number>(0);
    const isPausedRef = useRef<boolean>(false);

    // ─── Duration Ticker ────────────────────────────────────────
    const startDurationTicker = useCallback(() => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = setInterval(() => {
            if (!isPausedRef.current) {
                const elapsed = (Date.now() - startTimeRef.current) / 1000 - pausedDurationRef.current;
                const pace = totalDistanceRef.current > 0
                    ? elapsed / (totalDistanceRef.current / 1000)
                    : 0;

                setMetrics((prev) => ({
                    ...prev,
                    duration_s: Math.floor(elapsed),
                    avg_pace_s_per_km: Math.round(pace * 100) / 100,
                }));
            }
        }, 1000);
    }, []);

    // ─── GPS Point Handler ──────────────────────────────────────
    const handleGPSPoint = useCallback((point: GPSPoint) => {
        if (isPausedRef.current) return;

        const newCoord: Coordinate = { latitude: point.lat, longitude: point.lng };
        setCurrentLocation(newCoord);
        setRoute((prev) => [...prev, newCoord]);

        if (lastCoordRef.current) {
            const d = haversineDistance(
                lastCoordRef.current.latitude, lastCoordRef.current.longitude,
                newCoord.latitude, newCoord.longitude
            );
            if (d > 2 && (point.accuracy_m == null || point.accuracy_m < 25)) {
                totalDistanceRef.current += d;
                setMetrics((prev) => ({ ...prev, distance_m: totalDistanceRef.current }));
            }
        }
        lastCoordRef.current = newCoord;

        if (point.speed_mps && point.speed_mps > maxSpeedRef.current) {
            maxSpeedRef.current = point.speed_mps;
            setMetrics((prev) => ({ ...prev, max_speed_mps: point.speed_mps! }));
        }
    }, []);

    // ─── Backend Sync ───────────────────────────────────────────
    const startSyncInterval = useCallback(() => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = setInterval(async () => {
            if (!runIdRef.current) return;
            const points = flushBuffer();
            if (points.length > 0) {
                try {
                    await api.syncPoints(runIdRef.current, points);
                } catch (e) {
                    console.error('[Sync] Failed to sync points, will retry:', e);
                }
            }
        }, SYNC_INTERVAL_MS);
    }, []);

    // ─── App State Listener ──────────────────────────────────────
    useEffect(() => {
        const handleAppState = (next: AppStateStatus) => {
            if (status === 'running' && next === 'active') {
                setOnPointCallback(handleGPSPoint);
            }
        };

        const sub = AppState.addEventListener('change', handleAppState);
        return () => sub.remove();
    }, [status, handleGPSPoint]);

    // ─── Cleanup on unmount ────────────────────────────────────
    useEffect(() => {
        return () => {
            if (subscriptionRef.current) subscriptionRef.current.remove();
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        };
    }, []);

    // ─── START RUN ──────────────────────────────────────────────
    const startRun = useCallback(async () => {
        const recovered = await recoverBuffer();
        if (recovered.length > 0) {
            console.log(`[Run] Recovered ${recovered.length} points from previous session`);
        }

        const session = await api.startRun(userId);
        runIdRef.current = session.id;
        startTimeRef.current = Date.now();
        pausedDurationRef.current = 0;
        totalDistanceRef.current = 0;
        maxSpeedRef.current = 0;
        lastCoordRef.current = null;
        isPausedRef.current = false;

        setRoute([]);
        setMetrics({ duration_s: 0, distance_m: 0, avg_pace_s_per_km: 0, max_speed_mps: 0 });
        setStatus('running');

        subscriptionRef.current = await startForegroundTracking(handleGPSPoint);
        await startBackgroundTracking();

        startSyncInterval();
        startDurationTicker();
    }, [userId, handleGPSPoint, startSyncInterval, startDurationTicker]);

    // ─── PAUSE RUN ─────────────────────────────────────────────
    const pauseRun = useCallback(() => {
        isPausedRef.current = true;
        setStatus('paused');
    }, []);

    // ─── RESUME RUN ────────────────────────────────────────────
    const resumeRun = useCallback(() => {
        isPausedRef.current = false;
        setStatus('running');
    }, []);

    // ─── STOP RUN ──────────────────────────────────────────────
    const stopRun = useCallback(async (difficulty?: string, notes?: string) => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
        await stopBackgroundTracking();

        if (syncIntervalRef.current) {
            clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = null;
        }
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        if (runIdRef.current) {
            const remaining = flushBuffer();
            if (remaining.length > 0) {
                try {
                    await api.syncPoints(runIdRef.current, remaining);
                } catch (e) {
                    console.error('[Sync] Final sync failed:', e);
                }
            }

            try {
                const result = await api.finishRun(runIdRef.current, difficulty, notes);
                setMetrics({
                    duration_s: result.duration_s ?? 0,
                    distance_m: result.distance_m ?? 0,
                    avg_pace_s_per_km: result.avg_pace_s_per_km ?? 0,
                    max_speed_mps: result.max_speed_mps ?? 0,
                });
            } catch (e) {
                console.error('[Run] Finish failed:', e);
            }
        }

        setStatus('finished');
        setOnPointCallback(null);
        runIdRef.current = null;
    }, []);

    return {
        status,
        route,
        metrics,
        currentLocation,
        startRun,
        pauseRun,
        resumeRun,
        stopRun,
    };
}
