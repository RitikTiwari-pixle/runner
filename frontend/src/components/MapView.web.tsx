/**
 * MapView (Web fallback) — Placeholder map for browser preview.
 * react-native-maps only works on iOS/Android, so we show a styled placeholder on web.
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Coordinate } from '../types/run';
import { useGlobalSettings } from '../context/GlobalSettingsContext';

export interface MapViewRef {
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => void;
}

interface Props {
    route: Coordinate[];
    currentLocation: Coordinate | null;
    isTracking: boolean;
    territories?: unknown[];
    currentUserId?: string;
    ownTerritoryColor?: string;
}

export default forwardRef<MapViewRef, Props>(function MapView({ route, currentLocation, isTracking }: Props, ref) {
    const mapRef = useRef<View>(null);
    const { settings } = useGlobalSettings();

    useImperativeHandle(ref, () => ({
        animateToRegion: () => {
            // No-op for web
        }
    }), []);
    
    const mapPlaceholderStyle = {
        ...styles.mapPlaceholder,
        backgroundColor: settings.darkMode ? '#1d1d2b' : '#f5f5f5'
    };

    return (
        <View style={styles.container}>
            <View style={mapPlaceholderStyle}>
                <Text style={styles.mapIcon}>🗺️</Text>
                <Text style={[styles.title, { color: settings.darkMode ? '#00FF88' : '#2E7D32' }]}>Territory Runner</Text>
                <Text style={[styles.subtitle, { color: settings.darkMode ? '#8ec3b9' : '#1B5E20' }]}>Map View</Text>

                {currentLocation ? (
                    <View style={[styles.coordBox, { 
                        backgroundColor: settings.darkMode ? 'rgba(0, 255, 136, 0.1)' : 'rgba(46, 125, 50, 0.1)',
                        borderColor: settings.darkMode ? 'rgba(0, 255, 136, 0.2)' : 'rgba(46, 125, 50, 0.3)'
                    }]}>
                        <Text style={[styles.coordText, { color: settings.darkMode ? '#00FF88' : '#1B5E20' }]}>
                            📍 {currentLocation.latitude.toFixed(4)}°N, {currentLocation.longitude.toFixed(4)}°E
                        </Text>
                    </View>
                ) : (
                    <Text style={[styles.hint, { color: settings.darkMode ? '#8ec3b9' : '#558B2F' }]}>Waiting for location...</Text>
                )}

                {isTracking && (
                    <View style={[styles.trackingBadge, {
                        backgroundColor: settings.darkMode ? 'rgba(0, 255, 136, 0.15)' : 'rgba(46, 125, 50, 0.15)'
                    }]}>
                        <View style={[styles.pulseDot, { backgroundColor: settings.darkMode ? '#00FF88' : '#2E7D32' }]} />
                        <Text style={[styles.trackingText, { color: settings.darkMode ? '#00FF88' : '#1B5E20' }]}>TRACKING • {route.length} points</Text>
                    </View>
                )}

                <Text style={[styles.note, { color: settings.darkMode ? '#5a7a8a' : '#666666' }]}>
                    Full interactive map available on iOS & Android
                </Text>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mapPlaceholder: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    mapIcon: {
        fontSize: 64,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#00FF88',
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '300',
        color: '#8ec3b9',
        letterSpacing: 4,
        textTransform: 'uppercase',
    },
    coordBox: {
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.2)',
        marginTop: 8,
    },
    coordText: {
        fontSize: 14,
        color: '#00FF88',
        fontFamily: 'monospace',
    },
    hint: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
    },
    trackingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 255, 136, 0.15)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        marginTop: 8,
    },
    pulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00FF88',
    },
    trackingText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    note: {
        fontSize: 12,
        color: '#555',
        marginTop: 20,
        fontStyle: 'italic',
    },
});
