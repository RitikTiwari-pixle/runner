/**
 * Core TypeScript interfaces for the Territory Runner app.
 */

export interface GPSPoint {
    lat: number;
    lng: number;
    altitude_m?: number;
    speed_mps?: number;
    accuracy_m?: number;
    timestamp: string; // ISO 8601
}

export interface RunMetrics {
    duration_s: number;
    distance_m: number;
    avg_pace_s_per_km: number;
    max_speed_mps: number;
}

export interface RunSession {
    id: string;
    user_id: string;
    started_at: string;
    ended_at?: string;
    duration_s?: number;
    distance_m?: number;
    avg_pace_s_per_km?: number;
    max_speed_mps?: number;
    is_valid: boolean;
    source: 'app';
}

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface Coordinate {
    latitude: number;
    longitude: number;
}
