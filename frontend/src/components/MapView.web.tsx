/**
 * MapView (Web fallback) — Placeholder map for browser preview.
 * react-native-maps only works on iOS/Android, so we show a styled placeholder on web.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Coordinate } from '../types/run';

interface Props {
    route: Coordinate[];
    currentLocation: Coordinate | null;
    isTracking: boolean;
}

export default function MapView({ route, currentLocation, isTracking }: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.mapPlaceholder}>
                <Text style={styles.mapIcon}>🗺️</Text>
                <Text style={styles.title}>Territory Runner</Text>
                <Text style={styles.subtitle}>Map View</Text>

                {currentLocation ? (
                    <View style={styles.coordBox}>
                        <Text style={styles.coordText}>
                            📍 {currentLocation.latitude.toFixed(4)}°N, {currentLocation.longitude.toFixed(4)}°E
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.hint}>Waiting for location...</Text>
                )}

                {isTracking && (
                    <View style={styles.trackingBadge}>
                        <View style={styles.pulseDot} />
                        <Text style={styles.trackingText}>TRACKING • {route.length} points</Text>
                    </View>
                )}

                <Text style={styles.note}>
                    Full interactive map available on iOS & Android
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mapPlaceholder: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1d1d2b',
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
