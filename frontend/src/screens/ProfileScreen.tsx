/**
 * ProfileScreen — User profile with stats, XP progress, and follow actions.
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { getProfile, getProgressionStatus, followUser, unfollowUser, checkIsFollowing } from '../services/apiService';
import { getUserId } from '../services/authService';

interface Props {
    userId: string;
    onBack?: () => void;
}

export default function ProfileScreen({ userId, onBack }: Props) {
    const [profile, setProfile] = useState<any>(null);
    const [progression, setProgression] = useState<any>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isOwnProfile = getUserId() === userId;

    const load = async () => {
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
    };

    useEffect(() => { load(); }, [userId]);

    const handleFollow = async () => {
        const myId = getUserId()!;
        if (isFollowing) {
            await unfollowUser(myId, userId);
            setIsFollowing(false);
        } else {
            await followUser(myId, userId);
            setIsFollowing(true);
        }
    };

    if (loading) return (
        <View style={s.center}><ActivityIndicator size="large" color="#00E676" /></View>
    );

    if (!profile) return (
        <View style={s.center}><Text style={s.errorText}>User not found</Text></View>
    );

    const xpProgress = progression?.level_progress ?? 0;

    return (
        <ScrollView
            style={s.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#00E676" />}
        >
            {onBack && (
                <TouchableOpacity onPress={onBack} style={s.backBtn}>
                    <Text style={s.backText}>← Back</Text>
                </TouchableOpacity>
            )}

            {/* Header */}
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
                        <Text style={s.levelText}>Lv {profile.level}</Text>
                    </View>
                </View>

                <Text style={s.displayName}>{profile.display_name || profile.username}</Text>
                <Text style={s.username}>@{profile.username}</Text>
                {profile.city && <Text style={s.location}>📍 {profile.city}{profile.state ? `, ${profile.state}` : ''}</Text>}

                {!isOwnProfile && (
                    <TouchableOpacity
                        style={[s.followBtn, isFollowing && s.followingBtn]}
                        onPress={handleFollow}
                    >
                        <Text style={s.followBtnText}>{isFollowing ? 'Following ✓' : 'Follow'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Social Stats */}
            <View style={s.statsRow}>
                <StatBox label="Followers" value={profile.followers} />
                <StatBox label="Following" value={profile.following} />
                <StatBox label="Runs" value={profile.run_count} />
                <StatBox label="Territories" value={profile.territory_count} />
            </View>

            {/* XP Progress */}
            <View style={s.card}>
                <Text style={s.cardTitle}>🏆 Progression</Text>
                <View style={s.xpBarBg}>
                    <View style={[s.xpBarFill, { width: `${Math.round(xpProgress * 100)}%` }]} />
                </View>
                <Text style={s.xpText}>
                    {profile.xp} XP • Level {profile.level} • {progression?.xp_to_next_level ?? 0} to next
                </Text>
                <Text style={s.streakText}>🔥 {progression?.streak_days ?? 0} day streak</Text>
            </View>

            {/* Running Stats */}
            <View style={s.card}>
                <Text style={s.cardTitle}>🏃 Running Stats</Text>
                <View style={s.statsGrid}>
                    <StatItem label="Distance" value={`${((profile.total_distance_m || 0) / 1000).toFixed(1)} km`} />
                    <StatItem label="Time" value={formatDuration(profile.total_duration_s)} />
                    <StatItem label="Territory" value={`${((profile.total_territory_sqm || 0) / 1000).toFixed(1)}k sqm`} />
                    <StatItem label="XP" value={`${profile.xp}`} />
                </View>
            </View>
        </ScrollView>
    );
}

function StatBox({ label, value }: { label: string; value: number }) {
    return (
        <View style={s.statBox}>
            <Text style={s.statValue}>{value ?? 0}</Text>
            <Text style={s.statLabel}>{label}</Text>
        </View>
    );
}

function StatItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.statItem}>
            <Text style={s.statItemValue}>{value}</Text>
            <Text style={s.statItemLabel}>{label}</Text>
        </View>
    );
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0E1A' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E1A' },
    errorText: { color: '#ff5252', fontSize: 16 },
    backBtn: { padding: 16, paddingBottom: 0 },
    backText: { color: '#00E676', fontSize: 16 },
    header: { alignItems: 'center', paddingVertical: 24 },
    avatarWrap: { position: 'relative', marginBottom: 12 },
    avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#00E676' },
    avatarPlaceholder: { backgroundColor: '#1A2030', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: '#00E676', fontSize: 36, fontWeight: 'bold' },
    levelBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#00E676', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
    levelText: { color: '#0A0E1A', fontSize: 12, fontWeight: 'bold' },
    displayName: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
    username: { color: '#8892A4', fontSize: 14, marginTop: 2 },
    location: { color: '#8892A4', fontSize: 13, marginTop: 4 },
    followBtn: { marginTop: 12, backgroundColor: '#00E676', paddingHorizontal: 32, paddingVertical: 10, borderRadius: 24 },
    followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#00E676' },
    followBtnText: { color: '#0A0E1A', fontWeight: 'bold', fontSize: 14 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1A2030' },
    statBox: { alignItems: 'center' },
    statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    statLabel: { color: '#8892A4', fontSize: 11, marginTop: 2 },
    card: { margin: 16, padding: 16, backgroundColor: '#111827', borderRadius: 12 },
    cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    xpBarBg: { height: 8, backgroundColor: '#1F2937', borderRadius: 4, overflow: 'hidden' },
    xpBarFill: { height: '100%', backgroundColor: '#00E676', borderRadius: 4 },
    xpText: { color: '#8892A4', fontSize: 12, marginTop: 6 },
    streakText: { color: '#FFB74D', fontSize: 14, marginTop: 6 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    statItem: { width: '50%', paddingVertical: 8 },
    statItemValue: { color: '#00E676', fontSize: 18, fontWeight: 'bold' },
    statItemLabel: { color: '#8892A4', fontSize: 12 },
});
