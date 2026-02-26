/**
 * MapView component — Google Maps with live polyline route overlay.
 * Centers on the user's current position and draws the run path.
 */

import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import RNMapView, { Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Coordinate } from '../types/run';

interface Props {
    route: Coordinate[];
    currentLocation: Coordinate | null;
    isTracking: boolean;
}

export default function MapView({ route, currentLocation, isTracking }: Props) {
    const mapRef = useRef<RNMapView>(null);

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
            // Default: center of India (New Delhi)
            latitude: 28.6139,
            longitude: 77.209,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        };

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
                customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
            >
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
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});

// Dark map style for premium look
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1d1d2b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    {
        featureType: 'administrative.country',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#4b6878' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#2c3e50' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1f2e3c' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#3c5a6e' }],
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#17263c' }],
    },
    {
        featureType: 'poi.park',
        elementType: 'geometry.fill',
        stylers: [{ color: '#1a3a2a' }],
    },
];
