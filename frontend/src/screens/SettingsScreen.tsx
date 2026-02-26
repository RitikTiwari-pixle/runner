/**
 * SettingsScreen — User settings, device connections, and app info.
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, Switch,
} from 'react-native';
import { getIntegrationStatus, disconnectProvider } from '../services/apiService';
import { getUserId, clearAuthState } from '../services/authService';

const PROVIDERS = [
    { key: 'strava', label: 'Strava', icon: '🟧', color: '#FC4C02' },
    { key: 'garmin', label: 'Garmin', icon: '🟢', color: '#00B4D8' },
    { key: 'coros', label: 'Coros', icon: '🔵', color: '#0066CC' },
];

export default function SettingsScreen({ onLogout }: { onLogout?: () => void }) {
    const [connections, setConnections] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const loadConnections = async () => {
        const myId = getUserId();
        if (!myId) return;
        try {
            const statuses = await getIntegrationStatus(myId);
            const map: Record<string, boolean> = {};
            statuses.forEach((s: any) => { map[s.provider] = s.connected; });
            setConnections(map);
        } catch (e) {
            console.error('[Settings] Load connections failed:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadConnections(); }, []);

    const handleDisconnect = (provider: string) => {
        Alert.alert(
            'Disconnect',
            `Are you sure you want to disconnect ${provider}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect', style: 'destructive',
                    onPress: async () => {
                        const myId = getUserId()!;
                        await disconnectProvider(myId, provider);
                        setConnections({ ...connections, [provider]: false });
                    },
                },
            ],
        );
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

    return (
        <ScrollView style={s.container}>
            <Text style={s.title}>⚙️ Settings</Text>

            {/* Connected Devices */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>Connected Devices</Text>
                {PROVIDERS.map((p) => (
                    <View key={p.key} style={s.row}>
                        <Text style={s.providerIcon}>{p.icon}</Text>
                        <Text style={s.providerLabel}>{p.label}</Text>
                        <View style={{ flex: 1 }} />
                        {connections[p.key] ? (
                            <TouchableOpacity
                                style={s.disconnectBtn}
                                onPress={() => handleDisconnect(p.key)}
                            >
                                <Text style={s.disconnectText}>Disconnect</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={s.statusChip}>
                                <Text style={s.statusText}>Not connected</Text>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {/* Preferences */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>Preferences</Text>
                <View style={s.row}>
                    <Text style={s.rowLabel}>🌙 Dark Mode</Text>
                    <Switch value={true} disabled trackColor={{ true: '#00E676' }} thumbColor="#FFFFFF" />
                </View>
                <View style={s.row}>
                    <Text style={s.rowLabel}>🔔 Notifications</Text>
                    <Switch value={true} trackColor={{ true: '#00E676', false: '#3E4758' }} thumbColor="#FFFFFF" />
                </View>
                <View style={s.row}>
                    <Text style={s.rowLabel}>📍 Background GPS</Text>
                    <Switch value={true} trackColor={{ true: '#00E676', false: '#3E4758' }} thumbColor="#FFFFFF" />
                </View>
                <View style={s.row}>
                    <Text style={s.rowLabel}>📊 Units</Text>
                    <Text style={s.rowValue}>Metric (km)</Text>
                </View>
            </View>

            {/* App Info */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>About</Text>
                <View style={s.row}>
                    <Text style={s.rowLabel}>Version</Text>
                    <Text style={s.rowValue}>1.0.0</Text>
                </View>
                <View style={s.row}>
                    <Text style={s.rowLabel}>Build</Text>
                    <Text style={s.rowValue}>Production</Text>
                </View>
            </View>

            {/* Logout */}
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                <Text style={s.logoutText}>Log Out</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0E1A' },
    title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', padding: 16, paddingBottom: 8 },
    section: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#111827', borderRadius: 12, overflow: 'hidden' },
    sectionTitle: { color: '#8892A4', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, padding: 14, paddingBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#1A2030' },
    rowLabel: { color: '#D1D5DB', fontSize: 15 },
    rowValue: { color: '#8892A4', fontSize: 14 },
    providerIcon: { fontSize: 20, marginRight: 10 },
    providerLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    disconnectBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#2D1515' },
    disconnectText: { color: '#FF5252', fontSize: 12, fontWeight: '600' },
    statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#1A2030' },
    statusText: { color: '#6B7280', fontSize: 11 },
    logoutBtn: { marginHorizontal: 16, marginTop: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2D1515', alignItems: 'center' },
    logoutText: { color: '#FF5252', fontSize: 16, fontWeight: 'bold' },
});
