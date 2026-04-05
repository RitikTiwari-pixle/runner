/**
 * RunScreen - Full-screen map with live run controls and territory rendering.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MapView, { MapViewRef } from '../components/MapView';
import RunControls from '../components/RunControls';
import RunMetricsDisplay from '../components/RunMetrics';
import { useRunTracker } from '../hooks/useRunTracker';
import { getCurrentLocation } from '../services/locationService';
import { getProfile, getTerritoriesInArea, updateProfile } from '../services/apiService';
import { Coordinate } from '../types/run';
import { useGlobalSettings } from '../context/GlobalSettingsContext';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../services/backgroundLocationService';

interface TerritoryData {
    id: string;
    owner_id: string;
    area_sqm: number;
    coordinates: number[][] | null;
    is_active: boolean;
}

interface RunScreenProps {
    userId: string;
}

const TERRITORY_COLORS = ['#00FF88', '#22D3EE', '#F97316', '#A3E635', '#F43F5E', '#8B5CF6', '#FACC15'];

function distanceMeters(a: Coordinate, b: Coordinate): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const part =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(1 - part));
}

function isHexColor(value: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export default function RunScreen({ userId }: RunScreenProps) {

    const {
        status,
        route,
        metrics,
        currentLocation,
        startRun,
        pauseRun,
        resumeRun,
        stopRun,
    } = useRunTracker(userId);

    const { settings } = useGlobalSettings();

    // MapView ref for animateToRegion
    const mapRef = useRef<MapViewRef>(null);

    const [initialLocation, setInitialLocation] = useState<Coordinate | null>(null);
    const [territories, setTerritories] = useState<TerritoryData[]>([]);
    const [territoryColor, setTerritoryColor] = useState('#00FF88');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [savingColor, setSavingColor] = useState(false);
    const lastFetchCenterRef = useRef<Coordinate | null>(null);
    const latestLocationRef = useRef<Coordinate | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const loc = await getCurrentLocation();
                setInitialLocation({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });
            } catch (err) {
                console.error('[RunScreen] Failed to get initial location:', err);
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const profile = await getProfile(userId);
                if (!profile) {
                    console.warn('[RunScreen] No profile data loaded');
                    setShowColorPicker(true);
                    return;
                }
                
                const profileColor = typeof profile?.territory_color === 'string' ? profile.territory_color : null;
                if (profileColor && isHexColor(profileColor)) {
                    setTerritoryColor(profileColor);
                    return;
                }
                
                if (profileColor && !isHexColor(profileColor)) {
                    console.warn(`[RunScreen] Invalid territory color from profile: "${profileColor}"`);
                }
                setShowColorPicker(true);
            } catch (err) {
                console.error('[RunScreen] Failed to load profile color:', err);
                setShowColorPicker(true);
            }
        })();
    }, [userId]);

    // Manage background location tracking
    useEffect(() => {
        const manageBackgroundTracking = async () => {
            const isRunning = status === 'active' || status === 'paused';
            
            if (isRunning && settings.backgroundGps) {
                try {
                    await startBackgroundLocationTracking();
                    console.log('[RunScreen] Background location tracking started');
                } catch (err) {
                    console.error('[RunScreen] Failed to start background tracking:', err);
                }
            } else {
                try {
                    await stopBackgroundLocationTracking();
                    console.log('[RunScreen] Background location tracking stopped');
                } catch (err) {
                    console.error('[RunScreen] Failed to stop background tracking:', err);
                }
            }
        };
        
        manageBackgroundTracking();
    }, [status, settings.backgroundGps]);

    const fetchNearbyTerritories = useCallback(async (center: Coordinate) => {
        const delta = 0.03;
        try {
            const data = await getTerritoriesInArea(
                center.latitude - delta,
                center.longitude - delta,
                center.latitude + delta,
                center.longitude + delta,
            );
            setTerritories(
                data.map((item) => ({
                    id: item.id,
                    owner_id: item.owner_id,
                    area_sqm: item.area_sqm,
                    coordinates: item.coordinates ?? null,
                    is_active: item.is_active,
                })),
            );
            lastFetchCenterRef.current = center;
        } catch (err) {
            console.warn('[RunScreen] Failed to load nearby territories:', err);
        }
    }, []);

    const displayLocation = currentLocation || initialLocation;

    useEffect(() => {
        if (!displayLocation) return;
        latestLocationRef.current = displayLocation;

        const lastCenter = lastFetchCenterRef.current;
        const movedFarEnough = !lastCenter || distanceMeters(lastCenter, displayLocation) > 150;
        if (movedFarEnough) {
            fetchNearbyTerritories(displayLocation);
        }
    }, [displayLocation?.latitude, displayLocation?.longitude, fetchNearbyTerritories]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const center = latestLocationRef.current;
            if (center) {
                fetchNearbyTerritories(center);
            }
        }, 25000);

        return () => clearInterval(intervalId);
    }, [fetchNearbyTerritories]);

    const handleStartRun = async () => {
        try {
            await startRun();
        } catch (err: any) {
            const message = err?.message || 'Unable to start run. Check location permission and try again.';
            Alert.alert('Cannot Start Run', message);
        }
    };

    const handleStopRun = async () => {
        try {
            await stopRun();
        } catch (err: any) {
            const message = err?.message || 'Unable to stop run.';
            if (message.includes('Speed too high')) {
                Alert.alert('Speed Too High', 'Vehicles are not allowed! Please run on foot.');
            } else {
                Alert.alert('Cannot Stop Run', message);
            }
        }
    };

    const handleSetTerritoryColor = async (color: string) => {
        if (!isHexColor(color) || savingColor) return;
        setSavingColor(true);
        setTerritoryColor(color);
        try {
            await updateProfile(userId, { territory_color: color });
        } catch (err) {
            console.warn('[RunScreen] Failed to save territory color:', err);
            Alert.alert('Color Update Failed', 'Could not save territory color. Please try again.');
        } finally {
            setSavingColor(false);
            setShowColorPicker(false);
        }
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

            <MapView
                ref={mapRef}
                route={route}
                currentLocation={displayLocation}
                isTracking={status === 'running'}
                territories={territories}
                currentUserId={userId}
                ownTerritoryColor={territoryColor}
            />

            {/* Locate Me Floating Button */}
            {displayLocation && (
                <TouchableOpacity
                    style={styles.locateMeButton}
                    activeOpacity={0.85}
                    onPress={() => {
                        mapRef.current?.animateToRegion({
                            latitude: displayLocation.latitude,
                            longitude: displayLocation.longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }, 500);
                    }}
                >
                    <View style={styles.locateMeIconWrap}>
                        <Text style={styles.locateMeIcon}>🎯</Text>
                    </View>
                </TouchableOpacity>
            )}

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                <View style={styles.header}>
                    <Text style={styles.logo}>TERRITORY</Text>
                    <Text style={styles.logoSub}>RUNNER</Text>
                    <TouchableOpacity
                        style={styles.colorChip}
                        onPress={() => setShowColorPicker((value) => !value)}
                        disabled={savingColor}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.colorDot, { backgroundColor: territoryColor }]} />
                        <Text style={styles.colorChipText}>Color</Text>
                    </TouchableOpacity>
                </View>

                {showColorPicker ? (
                    <View style={styles.colorPanel}>
                        <Text style={styles.colorPanelTitle}>Choose Territory Color</Text>
                        <View style={styles.colorRow}>
                            {TERRITORY_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        territoryColor === color && styles.colorOptionActive,
                                    ]}
                                    onPress={() => handleSetTerritoryColor(color)}
                                    disabled={savingColor}
                                    activeOpacity={0.85}
                                />
                            ))}
                        </View>
                    </View>
                ) : null}

                {status !== 'idle' && <RunMetricsDisplay metrics={metrics} />}

                <View style={styles.spacer} />

                {status === 'running' ? (
                    <View style={styles.statusBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.statusText}>TRACKING ACTIVE</Text>
                    </View>
                ) : null}
                {status === 'paused' ? (
                    <View style={[styles.statusBadge, styles.pausedBadge]}>
                        <Text style={styles.statusText}>PAUSED</Text>
                    </View>
                ) : null}

                <RunControls
                    status={status}
                    onStart={handleStartRun}
                    onPause={pauseRun}
                    onResume={resumeRun}
                    onStop={handleStopRun}
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
        locateMeButton: {
            position: 'absolute',
            right: 18,
            bottom: 120,
            zIndex: 10,
            backgroundColor: '#111827ee',
            borderRadius: 28,
            width: 56,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#00FF88',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
            borderWidth: 1,
            borderColor: '#222',
        },
        locateMeIconWrap: {
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 20,
        },
        locateMeIcon: {
            fontSize: 28,
            color: '#00FF88',
        },
    screen: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 8,
        gap: 6,
    },
    logo: {
        fontSize: 20,
        fontWeight: '900',
        color: '#00FF88',
        letterSpacing: 2,
    },
    logoSub: {
        fontSize: 20,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 2,
        marginRight: 'auto',
    },
    colorChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: 'rgba(10, 16, 30, 0.82)',
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    colorChipText: {
        color: '#E2E8F0',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase',
    },
    colorPanel: {
        marginTop: 10,
        marginHorizontal: 18,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: 'rgba(10, 16, 30, 0.92)',
        padding: 12,
    },
    colorPanelTitle: {
        color: '#E2E8F0',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 10,
        letterSpacing: 0.6,
    },
    colorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    colorOption: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorOptionActive: {
        borderColor: '#F8FAFC',
    },
    spacer: {
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 255, 136, 0.15)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.3)',
    },
    pausedBadge: {
        backgroundColor: 'rgba(255, 186, 0, 0.15)',
        borderColor: 'rgba(255, 186, 0, 0.3)',
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00FF88',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 1.4,
    },
});
