/**
 * MapView component — Dark gaming-themed Google Maps with:
 * - Live polyline route overlay (neon green)
 * - Start marker (so the runner knows where to loop back)
 * - Loop-close indicator when runner is near the start point
 * - Territory polygons (own = green, enemy = red)
 * - Pulsing current-position circle
 */

import React, { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import RNMapView, { Polyline, Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Coordinate } from '../types/run';
import TerritoryOverlay from './TerritoryOverlay';
import { useGlobalSettings } from '../context/GlobalSettingsContext';

interface TerritoryData {
    id: string;
    owner_id: string;
    area_sqm: number;
    coordinates: number[][] | null;
    is_active: boolean;
}

export interface MapViewRef {
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => void;
}

interface Props {
    route: Coordinate[];
    currentLocation: Coordinate | null;
    isTracking: boolean;
    territories?: TerritoryData[];
    currentUserId?: string;
    ownTerritoryColor?: string;
}

// Distance (meters) at which we show the "loop closing" indicator
const LOOP_CLOSE_THRESHOLD_M = 50;

/** Quick haversine for loop-detection (meters) */
function quickDistance(a: Coordinate, b: Coordinate): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default forwardRef<MapViewRef, Props>(function MapView({
    route,
    currentLocation,
    isTracking,
    territories = [],
    currentUserId = '',
    ownTerritoryColor = '#00FF88',
}, ref) {
    const mapRef = useRef<RNMapView>(null);
    const { settings } = useGlobalSettings();

    useImperativeHandle(ref, () => ({
        animateToRegion: (region, duration) => {
            mapRef.current?.animateToRegion(region, duration);
        }
    }), []);

    // Animate to user's current location as they run
    useEffect(() => {
        if (currentLocation && mapRef.current && isTracking) {
            mapRef.current.animateToRegion(
                {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                },
                500
            );
        }
    }, [currentLocation, isTracking]);

    const initialRegion = currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }
        : {
            latitude: 28.6139,
            longitude: 77.209,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        };

    // Start point of the run
    const startPoint: Coordinate | null = route.length > 0 ? route[0] : null;

    // Detect if runner is close enough to the start to form a loop
    const isNearStart = useMemo(() => {
        if (!startPoint || !currentLocation || route.length < 10) return false;
        return quickDistance(startPoint, currentLocation) < LOOP_CLOSE_THRESHOLD_M;
    }, [startPoint, currentLocation, route.length]);

    // "Closing line" from current position back to start (dashed visual cue)
    const closingLine: Coordinate[] | null =
        isNearStart && currentLocation && startPoint
            ? [currentLocation, startPoint]
            : null;

    return (
        <View style={styles.container}>
            <RNMapView
                ref={mapRef}
                style={styles.map}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                initialRegion={initialRegion}
                showsUserLocation={true}
                showsMyLocationButton={!isTracking}
                followsUserLocation={isTracking}
                showsCompass={true}
                mapType="standard"
                customMapStyle={settings.darkMode ? darkMapStyle : undefined}
            >
                {/* Territory polygons */}
                {territories.length > 0 && (
                    <TerritoryOverlay
                        territories={territories}
                        currentUserId={currentUserId}
                        ownTerritoryColor={ownTerritoryColor}
                    />
                )}

                {/* Live route polyline */}
                {route.length >= 2 && (
                    <Polyline
                        coordinates={route}
                        strokeColor="#00FF88"
                        strokeWidth={4}
                        lineJoin="round"
                        lineCap="round"
                    />
                )}

                {/* Closing-loop dashed line */}
                {closingLine && (
                    <Polyline
                        coordinates={closingLine}
                        strokeColor="#FFBA00"
                        strokeWidth={3}
                        lineDashPattern={[8, 6]}
                        lineJoin="round"
                    />
                )}

                {/* Start marker */}
                {startPoint && isTracking && (
                    <Marker
                        coordinate={startPoint}
                        anchor={{ x: 0.5, y: 0.5 }}
                        tracksViewChanges={false}
                    >
                        <View style={styles.startMarkerOuter}>
                            <View style={[
                                styles.startMarkerInner,
                                isNearStart && styles.startMarkerPulse,
                            ]} />
                        </View>
                    </Marker>
                )}

                {/* Loop-close zone ring */}
                {startPoint && isTracking && (
                    <Circle
                        center={startPoint}
                        radius={LOOP_CLOSE_THRESHOLD_M}
                        fillColor={isNearStart
                            ? 'rgba(255, 186, 0, 0.12)'
                            : 'rgba(0, 255, 136, 0.06)'}
                        strokeColor={isNearStart ? '#FFBA00' : 'rgba(0, 255, 136, 0.2)'}
                        strokeWidth={1}
                    />
                )}

                {/* Pulsing dot at current position during tracking */}
                {currentLocation && isTracking && (
                    <Circle
                        center={currentLocation}
                        radius={8}
                        fillColor="rgba(0, 255, 136, 0.3)"
                        strokeColor="#00FF88"
                        strokeWidth={2}
                    />
                )}
            </RNMapView>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    startMarkerOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 255, 136, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#00FF88',
    },
    startMarkerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00FF88',
    },
    startMarkerPulse: {
        backgroundColor: '#FFBA00',
    },
});

// ─── Dark Map Style (Gaming Theme) ──────────────────────────────
const darkMapStyle = [
    // Base geometry
    { elementType: 'geometry', stylers: [{ color: '#0A0E1A' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#5a7a8a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0E1A' }] },
    // Admin boundaries
    {
        featureType: 'administrative.country',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1F2937' }],
    },
    {
        featureType: 'administrative.locality',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#6B8A9A' }],
    },
    // Roads — subtle dark
    {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#141B2D' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#0F1523' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#1C2940' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#0F1B2D' }],
    },
    {
        featureType: 'road.arterial',
        elementType: 'geometry',
        stylers: [{ color: '#182035' }],
    },
    // Labels on roads
    {
        featureType: 'road',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#3A5060' }],
    },
    // Water — deep blue
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#0C1929' }],
    },
    {
        featureType: 'water',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#1E3A5F' }],
    },
    // Parks — dark green
    {
        featureType: 'poi.park',
        elementType: 'geometry.fill',
        stylers: [{ color: '#0D1F15' }],
    },
    {
        featureType: 'poi.park',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#2A5A3F' }],
    },
    // Other POIs — hide them for cleaner look
    {
        featureType: 'poi.business',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'poi.attraction',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'poi.government',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'poi.medical',
        stylers: [{ visibility: 'off' }],
    },
    {
        featureType: 'poi.school',
        stylers: [{ visibility: 'off' }],
    },
    // Transit — very subtle
    {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#111827' }],
    },
    {
        featureType: 'transit.station',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#3A5A6A' }],
    },
    // Landscape — base fill
    {
        featureType: 'landscape.man_made',
        elementType: 'geometry',
        stylers: [{ color: '#0C1120' }],
    },
    {
        featureType: 'landscape.natural',
        elementType: 'geometry',
        stylers: [{ color: '#0A0E1A' }],
    },
];
