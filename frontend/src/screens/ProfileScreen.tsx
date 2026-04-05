/**
 * ProfileScreen — Enhanced user profile with stats, XP progress, and social actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
    getProfile, getProgressionStatus, followUser, unfollowUser, checkIsFollowing,
} from '../services/apiService';
import { getUserId } from '../services/authService';
import { formatDuration } from '../utils/geo';
import { useGlobalSettings } from '../context/GlobalSettingsContext';
import { convertDistance } from '../utils/distanceUnits';

interface Props {
    userId: string;
    onBack?: () => void;
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: string }) {
    return (
        <View style={s.statBox}>
            <Text style={s.statBoxIcon}>{icon}</Text>
            <Text style={s.statValue}>{value ?? 0}</Text>
            <Text style={s.statLabel}>{label}</Text>
        </View>
    );
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <View style={s.statItem}>
            <Text style={[s.statItemValue, color ? { color } : {}]}>{value}</Text>
            <Text style={s.statItemLabel}>{label}</Text>
        </View>
    );
}

export default function ProfileScreen({ userId, onBack }: Props) {
    const [profile, setProfile] = useState<any>(null);
    const [progression, setProgression] = useState<any>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const { settings } = useGlobalSettings();

    const isOwnProfile = getUserId() === userId;

    const load = useCallback(async () => {
        try {
            const [p, prog] = await Promise.all([
                getProfile(userId),
                getProgressionStatus(userId),
            ]);
            setProfile(p);
            setProgression(prog);
            if (!isOwnProfile && getUserId()) {
                const following = await checkIsFollowing(getUserId()!, userId);
                setIsFollowing(following);
            }
        } catch (e) {
            console.error('[Profile] Load failed:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, isOwnProfile]);

    useEffect(() => { load(); }, [userId, load]);

    const handleFollow = async () => {
        setFollowLoading(true);
        const myId = getUserId()!;
        try {
            if (isFollowing) { await unfollowUser(myId, userId); setIsFollowing(false); }
            else { await followUser(myId, userId); setIsFollowing(true); }
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) return (
        <View style={s.center}>
            <ActivityIndicator size="large" color="#00FF88" />
            <Text style={s.loadingText}>Loading profile...</Text>
        </View>
    );

    if (!profile) return (
        <View style={s.center}>
            <Text style={s.errorEmoji}>👤</Text>
            <Text style={s.errorText}>User not found</Text>
        </View>
    );

    const xpProgress = progression?.level_progress ?? 0;
    const xpPercent = Math.round(xpProgress * 100);

    return (
        <ScrollView
            style={s.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load(); }}
                    tintColor="#00FF88"
                />
            }
        >
            {/* Background orb */}
            <View style={s.bgOrb} />

            {/* Back button */}
            {onBack && (
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Text style={s.backText}>← Back</Text>
                </TouchableOpacity>
            )}

            {/* Profile header */}
            <View style={s.header}>
                <View style={s.avatarWrap}>
                    {profile.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                    ) : (
                        <View style={[s.avatar, s.avatarPlaceholder]}>
                            <Text style={s.avatarLetter}>
                                {(profile.display_name || profile.username)?.[0]?.toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={s.levelBadge}>
                        <Text style={s.levelText}>LV {profile.level}</Text>
                    </View>
                </View>

                <Text style={s.displayName}>{profile.display_name || profile.username}</Text>
                <Text style={s.username}>@{profile.username}</Text>
                {profile.city && (
                    <Text style={s.location}>📍 {profile.city}{profile.state ? `, ${profile.state}` : ''}</Text>
                )}

                {/* Streak badge */}
                {(progression?.streak_days ?? 0) > 0 && (
                    <View style={s.streakBadge}>
                        <Text style={s.streakBadgeText}>🔥 {progression.streak_days} day streak</Text>
                    </View>
                )}

                {!isOwnProfile && (
                    <TouchableOpacity
                        style={[s.followBtn, isFollowing && s.followingBtn]}
                        onPress={handleFollow}
                        disabled={followLoading}
                        activeOpacity={0.8}
                    >
                        {followLoading ? (
                            <ActivityIndicator color={isFollowing ? '#00FF88' : '#030F06'} size="small" />
                        ) : (
                            <Text style={isFollowing ? s.followingBtnText : s.followBtnText}>
                                {isFollowing ? '✓  Following' : '+ Follow'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {isOwnProfile && (
                    <View style={s.ownProfileBadge}>
                        <Text style={s.ownProfileBadgeText}>✦ Your Profile</Text>
                    </View>
                )}
            </View>

            {/* Social stats */}
            <View style={s.socialRow}>
                <StatBox label="Followers" value={profile.followers} icon="👥" />
                <View style={s.statDivider} />
                <StatBox label="Following" value={profile.following} icon="➡️" />
                <View style={s.statDivider} />
                <StatBox label="Runs" value={profile.run_count} icon="🏃" />
                <View style={s.statDivider} />
                <StatBox label="Zones" value={profile.territory_count} icon="🗺️" />
            </View>

            {/* XP Progression */}
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>⚡ Progression</Text>
                    <Text style={s.cardBadge}>Level {profile.level}</Text>
                </View>
                <View style={s.xpBarBg}>
                    <View style={[s.xpBarFill, { width: `${xpPercent}%` as any }]} />
                </View>
                <View style={s.xpFooter}>
                    <Text style={s.xpText}>{profile.xp} XP total</Text>
                    <Text style={s.xpToNext}>{progression?.xp_to_next_level ?? 0} to next level</Text>
                </View>
            </View>

            {/* Running Stats */}
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>🏃 Running Stats</Text>
                </View>
                <View style={s.statsGrid}>
                    <StatItem label="Distance" value={convertDistance(profile.total_distance_m || 0, settings.distanceUnit)} color="#00B4FF" />
                    <StatItem label="Time" value={formatDuration(profile.total_duration_s)} color="#00FF88" />
                    <StatItem label="Territory" value={`${((profile.total_territory_sqm || 0) / 1000).toFixed(1)}k sqm`} color="#FFD700" />
                    <StatItem label="XP Earned" value={`${profile.xp}`} color="#FF6B6B" />
                </View>
            </View>

            {/* Activity placeholder */}
            <View style={s.card}>
                <Text style={s.cardTitle}>📅 Recent Runs</Text>
                <View style={s.emptyActivity}>
                    <Text style={s.emptyActivityIcon}>🏁</Text>
                    <Text style={s.emptyActivityText}>
                        No runs recorded yet. Start running to fill this section!
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#040810' },
    bgOrb: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(0,255,136,0.08)',
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#040810', gap: 12 },
    loadingText: { color: '#475569', fontSize: 14 },
    errorEmoji: { fontSize: 40 },
    errorText: { color: '#FF6B6B', fontSize: 16 },
    backBtn: { padding: 16, paddingBottom: 0 },
    backText: { color: '#00FF88', fontSize: 15, fontWeight: '700' },
    header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
    avatarWrap: { position: 'relative', marginBottom: 14 },
    avatar: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 3,
        borderColor: '#00FF88',
        shadowColor: '#00FF88',
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    avatarPlaceholder: { backgroundColor: '#0C1827', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: '#00FF88', fontSize: 40, fontWeight: '900' },
    levelBadge: {
        position: 'absolute',
        bottom: -4,
        right: -8,
        backgroundColor: '#00FF88',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderWidth: 2,
        borderColor: '#040810',
    },
    levelText: { color: '#030F06', fontSize: 11, fontWeight: '900' },
    displayName: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginBottom: 4 },
    username: { color: '#475569', fontSize: 14, marginBottom: 4 },
    location: { color: '#64748B', fontSize: 13, marginBottom: 10 },
    streakBadge: {
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.4)',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 12,
    },
    streakBadgeText: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
    followBtn: {
        backgroundColor: '#00FF88',
        paddingHorizontal: 36,
        paddingVertical: 12,
        borderRadius: 28,
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    followingBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#00FF88' },
    followBtnText: { color: '#030F06', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
    followingBtnText: { color: '#00FF88', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
    ownProfileBadge: {
        backgroundColor: 'rgba(0,180,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(0,180,255,0.3)',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    ownProfileBadgeText: { color: '#00B4FF', fontSize: 12, fontWeight: '700' },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginHorizontal: 16,
        marginBottom: 14,
        backgroundColor: '#0A1220',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingVertical: 16,
    },
    statBox: { alignItems: 'center', flex: 1, gap: 4 },
    statBoxIcon: { fontSize: 16, marginBottom: 4 },
    statDivider: { width: 1, backgroundColor: '#1E293B' },
    statValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
    statLabel: { color: '#475569', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
    card: {
        marginHorizontal: 16,
        marginBottom: 14,
        padding: 18,
        backgroundColor: '#0A1220',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
    cardBadge: {
        color: '#00FF88',
        fontSize: 12,
        fontWeight: '700',
        backgroundColor: 'rgba(0,255,136,0.12)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    xpBarBg: {
        height: 10,
        backgroundColor: '#1E293B',
        borderRadius: 5,
        overflow: 'hidden',
    },
    xpBarFill: {
        height: '100%',
        backgroundColor: '#00FF88',
        borderRadius: 5,
        shadowColor: '#00FF88',
        shadowOpacity: 0.5,
        shadowRadius: 6,
    },
    xpFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    xpText: { color: '#64748B', fontSize: 12 },
    xpToNext: { color: '#00FF88', fontSize: 12, fontWeight: '700' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    statItem: { width: '50%', paddingVertical: 10, gap: 4 },
    statItemValue: { color: '#00FF88', fontSize: 22, fontWeight: '900' },
    statItemLabel: { color: '#475569', fontSize: 12 },
    emptyActivity: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    emptyActivityIcon: { fontSize: 36 },
    emptyActivityText: { color: '#475569', fontSize: 13, textAlign: 'center' },
});
