/**
 * FeedScreen — Social activity feed from friends and personal history.
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { getFriendsFeed, getPersonalFeed } from '../services/apiService';
import { getUserId } from '../services/authService';

const ACTIVITY_ICONS: Record<string, string> = {
    run_completed: '🏃',
    territory_captured: '🗺️',
    territory_stolen: '⚔️',
    level_up: '🎉',
    challenge_completed: '🏅',
    streak: '🔥',
};

const ACTIVITY_VERBS: Record<string, string> = {
    run_completed: 'completed a run',
    territory_captured: 'captured territory',
    territory_stolen: 'stole territory',
    level_up: 'leveled up',
    challenge_completed: 'completed a challenge',
    streak: 'extended their streak',
};

export default function FeedScreen({ onViewProfile }: { onViewProfile?: (id: string) => void }) {
    const [tab, setTab] = useState<'friends' | 'personal'>('friends');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        const myId = getUserId();
        if (!myId) { setLoading(false); return; }

        try {
            const data = tab === 'friends'
                ? await getFriendsFeed(myId, 50)
                : await getPersonalFeed(myId, 50);
            setItems(data);
        } catch (e) {
            console.error('[Feed] Load failed:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { setLoading(true); load(); }, [tab]);

    const renderItem = ({ item }: { item: any }) => {
        const icon = ACTIVITY_ICONS[item.type] || '📌';
        const verb = ACTIVITY_VERBS[item.type] || item.type;
        const name = item.display_name || item.username || 'You';
        const meta = item.metadata || {};
        const timeAgo = getTimeAgo(item.created_at);

        return (
            <TouchableOpacity
                style={s.card}
                onPress={() => item.user_id && onViewProfile?.(item.user_id)}
                activeOpacity={0.8}
            >
                <View style={s.cardHeader}>
                    <Text style={s.icon}>{icon}</Text>
                    <View style={s.cardInfo}>
                        <Text style={s.cardTitle} numberOfLines={1}>
                            <Text style={s.nameText}>{name}</Text>
                            {' '}{verb}
                        </Text>
                        <Text style={s.timeText}>{timeAgo}</Text>
                    </View>
                </View>

                {/* Metadata details */}
                {item.type === 'run_completed' && meta.distance_m && (
                    <View style={s.detailRow}>
                        <DetailChip label="Distance" value={`${(meta.distance_m / 1000).toFixed(1)} km`} />
                        {meta.duration_s && <DetailChip label="Time" value={formatDuration(meta.duration_s)} />}
                    </View>
                )}
                {item.type === 'territory_captured' && (
                    <View style={s.detailRow}>
                        <DetailChip label="Territories" value={`${meta.count}`} />
                        <DetailChip label="Area" value={`${((meta.area_sqm || 0) / 1000).toFixed(1)}k sqm`} />
                    </View>
                )}
                {item.type === 'territory_stolen' && (
                    <View style={s.detailRow}>
                        <DetailChip label="Stolen" value={`${meta.count} territories`} />
                    </View>
                )}
                {item.type === 'level_up' && (
                    <View style={s.detailRow}>
                        <DetailChip label="New Level" value={`Level ${meta.new_level}`} />
                        <DetailChip label="Total XP" value={`${meta.xp}`} />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            <Text style={s.title}>📢 Activity Feed</Text>

            <View style={s.tabRow}>
                <TouchableOpacity style={[s.tab, tab === 'friends' && s.activeTab]} onPress={() => setTab('friends')}>
                    <Text style={[s.tabText, tab === 'friends' && s.activeTabText]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'personal' && s.activeTab]} onPress={() => setTab('personal')}>
                    <Text style={[s.tabText, tab === 'personal' && s.activeTabText]}>My Activity</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#00E676" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#00E676" />}
                    ListEmptyComponent={
                        <Text style={s.empty}>
                            {tab === 'friends' ? 'Follow runners to see their activity! 👋' : 'Complete a run to see your activity! 🏃'}
                        </Text>
                    }
                    contentContainerStyle={{ paddingBottom: 90 }}
                />
            )}
        </View>
    );
}

function DetailChip({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.chip}>
            <Text style={s.chipLabel}>{label}</Text>
            <Text style={s.chipValue}>{value}</Text>
        </View>
    );
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0E1A' },
    title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', padding: 16, paddingBottom: 8 },
    tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111827' },
    activeTab: { backgroundColor: '#00E676' },
    tabText: { color: '#8892A4', fontWeight: '600' },
    activeTabText: { color: '#0A0E1A' },
    card: { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: '#111827', borderRadius: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    icon: { fontSize: 24, marginRight: 10 },
    cardInfo: { flex: 1 },
    cardTitle: { color: '#D1D5DB', fontSize: 14 },
    nameText: { color: '#FFFFFF', fontWeight: 'bold' },
    timeText: { color: '#6B7280', fontSize: 11, marginTop: 2 },
    detailRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
    chip: { backgroundColor: '#1A2030', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    chipLabel: { color: '#6B7280', fontSize: 10 },
    chipValue: { color: '#00E676', fontSize: 14, fontWeight: 'bold' },
    empty: { color: '#8892A4', textAlign: 'center', marginTop: 40, fontSize: 14, paddingHorizontal: 32 },
});
