/**
 * RunMetrics — Heads-up display showing live duration, distance, and pace.
 * Glassmorphism overlay at the top of the run screen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RunMetrics as RunMetricsType } from '../types/run';
import { formatDuration, formatDistance, formatPace } from '../utils/geo';
import { useGlobalSettings } from '../context/GlobalSettingsContext';
import { convertDistance } from '../utils/distanceUnits';

interface Props {
    metrics: RunMetricsType;
}

export default function RunMetrics({ metrics }: Props) {
    const { settings } = useGlobalSettings();

    return (
        <View style={styles.container}>
            <View style={styles.metricCard}>
                <Text style={styles.value}>{formatDuration(metrics.duration_s)}</Text>
                <Text style={styles.label}>DURATION</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricCard}>
                <Text style={styles.value}>{convertDistance(metrics.distance_m, settings.distanceUnit)}</Text>
                <Text style={styles.label}>DISTANCE</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricCard}>
                <Text style={styles.value}>{formatPace(metrics.avg_pace_s_per_km)}</Text>
                <Text style={styles.label}>PACE /km</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        borderRadius: 20,
        marginHorizontal: 16,
        marginTop: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        // Glassmorphism
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    metricCard: {
        flex: 1,
        alignItems: 'center',
    },
    value: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
        letterSpacing: 1,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 4,
        letterSpacing: 1.5,
    },
    divider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
});
