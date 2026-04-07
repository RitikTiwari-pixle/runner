import React, { useState, useCallback } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { getProfile } from '../services/apiService';
import * as api from '../services/apiService';
import { getUserId } from '../services/authService';
import type { MainTabParamList } from '../navigation/types';

type HomeScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Home'>;

interface HomeScreenProps {
    userId?: string;
}

interface UserProfile {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    level: number;
    xp: number;
    total_distance_m: number;
    total_territory_sqm: number;
}

interface StatCardProps {
    title: string;
    value: string | number;
    unit: string;
    icon: string;
    color: string;
    bgColor: string;
}

function StatCard({ title, value, unit, icon, color, bgColor }: StatCardProps) {
    return (
        <View style={[styles.statCard, { borderColor: color + '30' }]}>
            <View style={[styles.statCardIcon, { backgroundColor: bgColor }]}>
                <Text style={styles.statCardIconText}>{icon}</Text>
            </View>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statUnit}>{unit}</Text>
            <Text style={styles.statCardTitle}>{title}</Text>
        </View>
    );
}

function QuickAction({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
    return (
        <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.quickActionIcon, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                <Text style={styles.quickActionIconText}>{icon}</Text>
            </View>
            <Text style={styles.quickActionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function HomeScreen({ userId: propsUserId }: HomeScreenProps) {
    const navigation = useNavigation<HomeScreenNavigationProp>();
    const authUserId = propsUserId || getUserId();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProfile = useCallback(async () => {
        if (!authUserId) { setError('User not authenticated'); setLoading(false); return; }
        try {
            setLoading(true);
            const data = await getProfile(authUserId);
            if (!data) { setError('Profile not found'); setProfile(null); }
            else { setProfile(data); setError(null); }
        } catch (err: any) {
            // Give a more specific message to help diagnose connectivity issues
            if (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK') {
                setError('Cannot reach server.\n\nMake sure the backend is running at\n' + (api.API_BASE_URL ?? 'unknown URL'));
            } else if (err?.response?.status === 404) {
                setError('Profile not found. It may still be setting up.');
            } else if (err?.response?.status === 401) {
                setError('Session expired. Please log out and log in again.');
            } else {
                setError('Failed to load profile. Check your connection and retry.');
            }
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, [authUserId]);

    useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

    const handleStartRun = () => navigation?.navigate('Map');

    if (loading) return (
        <SafeAreaView style={styles.container}>
            <View style={styles.centerContent}>
                <ActivityIndicator size="large" color="#00FF88" />
                <Text style={styles.loadingText}>Loading your territory...</Text>
            </View>
        </SafeAreaView>
    );

    if (error || !profile) return (
        <SafeAreaView style={styles.container}>
            <View style={styles.centerContent}>
                <Text style={styles.errorEmoji}>📡</Text>
                <Text style={styles.errorText}>{error || 'Profile not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadProfile} activeOpacity={0.8}>
                    <Text style={styles.retryButtonText}>↻  Retry</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );

    const distanceKm = (profile.total_distance_m / 1000).toFixed(1);
    const territorySqm = (profile.total_territory_sqm / 1000).toFixed(1);
    const xpPercent = Math.min((profile.xp % 1000) / 10, 100);
    const xpToNext = 1000 - (profile.xp % 1000);

    return (
        <SafeAreaView style={styles.container}>
            {/* Decorative orb */}
            <View style={styles.bgOrb} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.appTitle}>TERRITORY</Text>
                    <Text style={styles.appSubtitle}>RUNNER</Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.levelPill}>
                        <Text style={styles.levelPillText}>LVL {profile.level}</Text>
                    </View>
                    <TouchableOpacity style={styles.avatarButton}>
                        {profile.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>
                                    {profile.display_name?.[0]?.toUpperCase() || 'U'}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scrollContent}
                contentContainerStyle={styles.scrollInner}
                showsVerticalScrollIndicator={false}
            >
                <View>
                    {/* Greeting */}
                    <View style={styles.greetingSection}>
                        <Text style={styles.greetingEmoji}>🏃</Text>
                        <View style={styles.greetingText}>
                            <Text style={styles.greetingTitle}>
                                Hello, {profile.display_name}!
                            </Text>
                            <Text style={styles.greetingSubtitle}>Ready to claim more territory?</Text>
                        </View>
                    </View>

                    {/* Start Run CTA — Prominent */}
                    <View>
                        <TouchableOpacity
                            style={styles.startRunButton}
                            onPress={handleStartRun}
                            activeOpacity={0.85}
                        >
                            <View style={styles.startRunInner}>
                                <Text style={styles.startRunIcon}>▶</Text>
                                <View style={styles.startRunContent}>
                                    <Text style={styles.startRunTitle}>START NEW RUN</Text>
                                    <Text style={styles.startRunSubtitle}>Capture more territory now</Text>
                                </View>
                                <Text style={styles.startRunArrow}>→</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Stats Grid */}
                    <Text style={styles.sectionTitle}>📊 YOUR STATS</Text>
                    <View style={styles.statsGrid}>
                        <StatCard
                            title="Territory"
                            value={territorySqm}
                            unit="k sqm"
                            icon="🗺️"
                            color="#00FF88"
                            bgColor="rgba(0,255,136,0.15)"
                        />
                        <StatCard
                            title="Distance"
                            value={distanceKm}
                            unit="km"
                            icon="🏃"
                            color="#00B4FF"
                            bgColor="rgba(0,180,255,0.15)"
                        />
                        <StatCard
                            title="Total XP"
                            value={profile.xp}
                            unit="points"
                            icon="⭐"
                            color="#FFD700"
                            bgColor="rgba(255,215,0,0.15)"
                        />
                        <StatCard
                            title="Level"
                            value={profile.level}
                            unit="rank"
                            icon="🏆"
                            color="#FF6B6B"
                            bgColor="rgba(255,107,107,0.15)"
                        />
                    </View>

                    {/* XP Progress */}
                    <View style={styles.xpCard}>
                        <View style={styles.xpHeader}>
                            <View>
                                <Text style={styles.xpTitle}>⚡ EXPERIENCE POINTS</Text>
                                <Text style={styles.xpSubtitle}>Level {profile.level} → Level {profile.level + 1}</Text>
                            </View>
                            <Text style={styles.xpValue}>{profile.xp} XP</Text>
                        </View>
                        <View style={styles.xpBarBg}>
                            <View
                                style={[
                                    styles.xpBarFill,
                                    { width: `${Math.min((profile.xp % 1000) / 10, 100)}%` },
                                ]}
                            >
                                {/* Glow dot rendered inside the fill bar so it stays at the right edge */}
                                {Platform.OS !== 'web' && (
                                    <View style={styles.xpBarGlow} />
                                )}
                            </View>
                        </View>
                        <View style={styles.xpFooter}>
                            <Text style={styles.xpRemaining}>{xpToNext} XP to next level</Text>
                            <Text style={styles.xpPercent}>{Math.round(xpPercent)}%</Text>
                        </View>
                    </View>

                    {/* Quick actions */}
                    <Text style={styles.sectionTitle}>🚀 QUICK ACTIONS</Text>
                    <View style={styles.quickActionsRow}>
                        <QuickAction
                            icon="🗺️"
                            label="Map"
                            color="#00FF88"
                            onPress={() => navigation?.navigate('Map')}
                        />
                        <QuickAction
                            icon="🏆"
                            label="Leaderboard"
                            color="#FFD700"
                            onPress={() => navigation?.navigate('Leaderboard')}
                        />
                        <QuickAction
                            icon="👤"
                            label="Profile"
                            color="#00B4FF"
                            onPress={() => navigation?.navigate('Profile')}
                        />
                        <QuickAction
                            icon="📢"
                            label="Feed"
                            color="#FF6B6B"
                            onPress={() => navigation?.navigate('Feed')}
                        />
                    </View>

                    {/* Recent activity */}
                    <View style={styles.activityCard}>
                        <Text style={styles.activityTitle}>📅 RECENT ACTIVITY</Text>
                        <View style={styles.activityEmpty}>
                            <Text style={styles.activityEmptyIcon}>🏁</Text>
                            <Text style={styles.activityEmptyText}>
                                Complete a run to see your activity here
                            </Text>
                            <TouchableOpacity
                                style={styles.activityCTA}
                                onPress={handleStartRun}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.activityCTAText}>Start Your First Run →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#040810' },
    bgOrb: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(0,255,136,0.07)',
    },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { color: '#475569', fontSize: 14 },
    errorEmoji: { fontSize: 40, marginBottom: 8 },
    errorText: { color: '#FF6B6B', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
    retryButton: {
        marginTop: 8,
        backgroundColor: '#00FF88',
        borderRadius: 12,
        paddingHorizontal: 28,
        paddingVertical: 12,
    },
    retryButtonText: { color: '#030F06', fontWeight: '800', fontSize: 14 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(30,41,59,0.8)',
    },
    headerLeft: {},
    appTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#00FF88',
        letterSpacing: 2.5,
        textShadowColor: 'rgba(0,255,136,0.4)',
        textShadowRadius: 10,
    },
    appSubtitle: {
        fontSize: 14,
        fontWeight: '300',
        color: '#94A3B8',
        letterSpacing: 2,
        marginTop: -3,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    levelPill: {
        backgroundColor: 'rgba(0,255,136,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.4)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    levelPillText: { color: '#00FF88', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    avatarButton: { position: 'relative', width: 46, height: 46 },
    avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#00FF88' },
    avatarPlaceholder: { backgroundColor: '#0C1827', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 18, fontWeight: 'bold', color: '#00FF88' },
    scrollContent: { flex: 1 },
    scrollInner: { paddingHorizontal: 20, paddingBottom: 24 },
    greetingSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
    },
    greetingEmoji: { fontSize: 32 },
    greetingText: {},
    greetingTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },
    greetingSubtitle: { color: '#64748B', fontSize: 13, marginTop: 2 },
    startRunButton: {
        backgroundColor: '#00FF88',
        borderRadius: 18,
        padding: 18,
        marginBottom: 24,
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 12,
    },
    startRunInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    startRunIcon: { fontSize: 22, color: '#030F06', fontWeight: '900' },
    startRunContent: { flex: 1 },
    startRunTitle: { fontSize: 17, fontWeight: '900', color: '#030F06', letterSpacing: 1 },
    startRunSubtitle: { fontSize: 12, color: '#1A4830', fontWeight: '500', marginTop: 2 },
    startRunArrow: { fontSize: 22, color: '#030F06', fontWeight: '900' },
    sectionTitle: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    statCard: {
        width: '47.5%',
        backgroundColor: '#0A1220',
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        gap: 6,
    },
    statCardIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    statCardIconText: { fontSize: 20 },
    statValue: { fontSize: 26, fontWeight: '900' },
    statUnit: { color: '#475569', fontSize: 11, fontWeight: '600', marginTop: -4 },
    statCardTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    xpCard: {
        backgroundColor: '#0A1220',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.2)',
        padding: 16,
        marginBottom: 20,
    },
    xpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    xpTitle: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    xpSubtitle: { color: '#475569', fontSize: 12, marginTop: 4 },
    xpValue: { color: '#00FF88', fontSize: 20, fontWeight: '900' },
    xpBarBg: {
        height: 10,
        backgroundColor: '#1E293B',
        borderRadius: 5,
        overflow: 'hidden',
        position: 'relative',
    },
    xpBarFill: {
        height: '100%',
        backgroundColor: '#00FF88',
        borderRadius: 5,
        shadowColor: '#00FF88',
        shadowOpacity: 0.6,
        shadowRadius: 6,
    },
    xpBarGlow: {
        position: 'absolute',
        top: -2,
        right: 0,
        width: 8,
        height: 14,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    xpFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    xpRemaining: { color: '#475569', fontSize: 12 },
    xpPercent: { color: '#00FF88', fontSize: 12, fontWeight: '700' },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    quickAction: { flex: 1, alignItems: 'center', gap: 8 },
    quickActionIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionIconText: { fontSize: 22 },
    quickActionLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    activityCard: {
        backgroundColor: '#0A1220',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 16,
        marginBottom: 8,
    },
    activityTitle: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
    activityEmpty: { alignItems: 'center', paddingVertical: 16, gap: 10 },
    activityEmptyIcon: { fontSize: 36 },
    activityEmptyText: { color: '#475569', fontSize: 13, textAlign: 'center' },
    activityCTA: {
        backgroundColor: 'rgba(0,255,136,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.3)',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    activityCTAText: { color: '#00FF88', fontSize: 13, fontWeight: '700' },
});
