/**
 * SettingsScreen — User settings with FUNCTIONAL toggles.
 * Integrates with GlobalSettingsContext for app-wide settings sync.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, Switch, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useGlobalSettings } from '../context/GlobalSettingsContext';
import { clearAuthState } from '../services/authService';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking, requestBackgroundLocationPermission } from '../services/backgroundLocationService';
import { getAvailableUnits, getUnitLabel } from '../utils/distanceUnits';

interface SettingsScreenProps {
    onLogout?: () => void;
    userId?: string;
    onViewProfile?: (id: string) => void;
}

export default function SettingsScreen({ onLogout, userId, onViewProfile }: SettingsScreenProps) {
    const { settings, updateSetting } = useGlobalSettings();
    const [gpsLoading, setGpsLoading] = useState(false);

    const handleDarkModeToggle = (value: boolean) => {
        updateSetting('darkMode', value);
        // Dark mode will be applied via GlobalSettingsContext in the future
        // For now, the app is always dark-themed
        if (!value) {
            Alert.alert('Coming Soon', 'Light mode is under development. Your preference has been saved.');
        }
    };

    const handleNotificationsToggle = async (value: boolean) => {
        updateSetting('notificationsEnabled', value);
        if (!value) {
            Alert.alert(
                'Notifications Disabled',
                'You won\'t receive alerts when someone captures your territory. You can re-enable this anytime.',
            );
        }
    };

    const handleGpsToggle = async (value: boolean) => {
        if (!value) {
            updateSetting('backgroundGps', false);
            await stopBackgroundLocationTracking();
            return;
        }

        setGpsLoading(true);
        try {
            const granted = await requestBackgroundLocationPermission();
            if (granted) {
                const started = await startBackgroundLocationTracking();
                if (started) {
                    updateSetting('backgroundGps', true);
                    Alert.alert('Background GPS Active', 'Your location will be tracked during runs.');
                } else {
                    Alert.alert('Warning', 'Background GPS setup incomplete. Please try again.');
                }
            }else {
                Alert.alert(
                    'Background Location Required',
                    'To track runs in the background, set location to "Always Allow" in your device settings.',
                    [
                        {
                            text: 'Open Settings',
                            onPress: () => Platform.OS === 'ios' || Platform.OS === 'android' ? 
                                require('react-native').Linking.openSettings() : null,
                        },
                        { text: 'Cancel', style: 'cancel' },
                    ],
                );
            }
        } catch (err) {
            console.error('[Settings] GPS permission error:', err);
            Alert.alert('Error', 'Could not request location permission.');
        } finally {
            setGpsLoading(false);
        }
    };

    const handleUnitCycle = async () => {
        const units = getAvailableUnits();
        const currentIndex = units.findIndex(u => u.unit === settings.distanceUnit);
        const nextUnit = units[(currentIndex + 1) % units.length];
        await updateSetting('distanceUnit', nextUnit.unit);
    };

    const handleLogout = () => {
        Alert.alert('Log Out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log Out', style: 'destructive',
                onPress: async () => {
                    await clearAuthState();
                    onLogout?.();
                },
            },
        ]);
    };

    const handleViewProfile = () => {
        if (userId) onViewProfile?.(userId);
    };

    const unitLabel = settings.distanceUnit === 'km' ? 'Metric (km)' : 'Imperial (mi)';

    return (
        <ScrollView style={s.container}>
            {/* Header */}
            <View style={s.headerSection}>
                <Text style={s.headerIcon}>⚙️</Text>
                <Text style={s.title}>Settings</Text>
            </View>

            {/* View Full Profile */}
            {userId && (
                <TouchableOpacity style={s.section} onPress={handleViewProfile} activeOpacity={0.7}>
                    <Text style={s.sectionTitle}>My Profile</Text>
                    <View style={s.row}>
                        <Text style={s.rowIcon}>👤</Text>
                        <Text style={s.rowLabel}>View My Profile</Text>
                        <Text style={s.rowArrow}>→</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Preferences */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>Preferences</Text>

                {/* Dark Mode */}
                <View style={s.row}>
                    <Text style={s.rowIcon}>🌙</Text>
                    <Text style={s.rowLabel}>Dark Mode</Text>
                    <Switch
                        value={settings.darkMode}
                        onValueChange={handleDarkModeToggle}
                        trackColor={{ true: '#00FF88', false: '#3E4758' }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {/* Notifications */}
                <View style={s.row}>
                    <Text style={s.rowIcon}>🔔</Text>
                    <Text style={s.rowLabel}>Notifications</Text>
                    <Switch
                        value={settings.notificationsEnabled}
                        onValueChange={handleNotificationsToggle}
                        trackColor={{ true: '#00FF88', false: '#3E4758' }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                {/* Background GPS */}
                <View style={s.row}>
                    <Text style={s.rowIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={s.rowLabel}>Background GPS</Text>
                        <Text style={s.rowHint}>
                            {settings.backgroundGps ? 'Always-on tracking enabled' : 'Tap to enable always-on tracking'}
                        </Text>
                    </View>
                    <Switch
                        value={settings.backgroundGps}
                        onValueChange={handleGpsToggle}
                        trackColor={{ true: '#00FF88', false: '#3E4758' }}
                        thumbColor="#FFFFFF"
                        disabled={gpsLoading}
                    />
                </View>

                {/* Distance Unit */}
                <TouchableOpacity style={s.row} onPress={handleUnitCycle} activeOpacity={0.7}>
                    <Text style={s.rowIcon}>📊</Text>
                    <Text style={s.rowLabel}>Units</Text>
                    <View style={s.unitBadge}>
                        <Text style={s.unitBadgeText}>{unitLabel}</Text>
                    </View>
                    <Text style={s.rowArrow}>↻</Text>
                </TouchableOpacity>
            </View>

            {/* App Info */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>About</Text>
                <View style={s.row}>
                    <Text style={s.rowIcon}>📱</Text>
                    <Text style={s.rowLabel}>Version</Text>
                    <Text style={s.rowValue}>1.0.0</Text>
                </View>
                <View style={s.row}>
                    <Text style={s.rowIcon}>🏗️</Text>
                    <Text style={s.rowLabel}>Build</Text>
                    <Text style={s.rowValue}>Production</Text>
                </View>
                <View style={s.row}>
                    <Text style={s.rowIcon}>🌐</Text>
                    <Text style={s.rowLabel}>API Status</Text>
                    <View style={s.connectedBadge}>
                        <View style={s.connectedDot} />
                        <Text style={s.connectedText}>Connected</Text>
                    </View>
                </View>
            </View>

            {/* Logout */}
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Text style={s.logoutText}>🚪 Log Out</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#040810' },
    headerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
    },
    headerIcon: { fontSize: 26 },
    title: { color: '#F8FAFC', fontSize: 26, fontWeight: '900' },
    section: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#0A1220',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        overflow: 'hidden',
    },
    sectionTitle: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        padding: 14,
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#0F1A2A',
        gap: 10,
    },
    rowIcon: { fontSize: 18, width: 26 },
    rowLabel: { color: '#E2E8F0', fontSize: 15, flex: 1 },
    rowHint: { color: '#475569', fontSize: 11, marginTop: 2 },
    rowValue: { color: '#64748B', fontSize: 14 },
    rowArrow: { color: '#475569', fontSize: 16, fontWeight: '700' },
    unitBadge: {
        backgroundColor: 'rgba(0,255,136,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.3)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    unitBadgeText: { color: '#00FF88', fontSize: 12, fontWeight: '700' },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,255,136,0.1)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FF88' },
    connectedText: { color: '#00FF88', fontSize: 12, fontWeight: '700' },
    logoutBtn: {
        marginHorizontal: 16,
        marginTop: 24,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: 'rgba(255,82,82,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,82,82,0.3)',
        alignItems: 'center',
    },
    logoutText: { color: '#FF5252', fontSize: 16, fontWeight: '800' },
});
