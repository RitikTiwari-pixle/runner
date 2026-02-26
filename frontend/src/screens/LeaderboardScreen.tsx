/**
 * LeaderboardScreen — Rankings by territory, distance, or XP.
 * Supports global, city, and friends-only tabs.
 */

import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { getLeaderboard, getFriendsLeaderboard } from '../services/apiService';
import { getUserId } from '../services/authService';

const TABS = ['Global', 'City', 'Friends'] as const;
const METRICS = ['territory', 'distance', 'xp'] as const;
const METRIC_LABELS: Record<string, string> = {
    territory: '🗺️ Territory',
    distance: '🏃 Distance',
    xp: '⭐ XP',
};

export default function LeaderboardScreen({ onViewProfile }: { onViewProfile?: (id: string) => void }) {
    const [tab, setTab] = useState<typeof TABS[number]>('Global');
    const [metric, setMetric] = useState<typeof METRICS[number]>('territory');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        try {
            let result;
            if (tab === 'Friends') {
                const myId = getUserId();
                if (myId) {
                    result = await getFriendsLeaderboard(myId, metric);
                }
            } else {
                result = await getLeaderboard(metric, tab === 'City' ? 'Mumbai' : undefined);
            }
            setData(result || []);
        } catch (e) {
            console.error('[Leaderboard] Load failed:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { setLoading(true); load(); }, [tab, metric]);

    const getMetricValue = (item: any) => {
        if (metric === 'territory') return `${((item.total_territory_sqm || 0) / 1000).toFixed(1)}k sqm`;
        if (metric === 'distance') return `${((item.total_distance_m || 0) / 1000).toFixed(1)} km`;
        return `${item.xp || 0} XP`;
    };

    const renderItem = ({ item }: { item: any }) => {
        const isMe = item.id === getUserId();
        return (
            <TouchableOpacity
                style={[s.row, isMe && s.myRow]}
                onPress={() => onViewProfile?.(item.id)}
                activeOpacity={0.7}
            >
                <View style={s.rankWrap}>
                    <Text style={[s.rank, item.rank <= 3 && s.topRank]}>
                        {item.rank <= 3 ? ['🥇', '🥈', '🥉'][item.rank - 1] : `#${item.rank}`}
                    </Text>
                </View>
                <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>
                        {item.display_name || item.username}
                        {isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={s.meta}>Lv {item.level} • {item.city || 'India'}</Text>
                </View>
                <Text style={s.value}>{getMetricValue(item)}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            <Text style={s.title}>🏆 Leaderboard</Text>

            {/* Tab selector */}
            <View style={s.tabRow}>
                {TABS.map((t) => (
                    <TouchableOpacity key={t} style={[s.tab, tab === t && s.activeTab]} onPress={() => setTab(t)}>
                        <Text style={[s.tabText, tab === t && s.activeTabText]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Metric selector */}
            <View style={s.metricRow}>
                {METRICS.map((m) => (
                    <TouchableOpacity key={m} style={[s.metricBtn, metric === m && s.activeMetric]} onPress={() => setMetric(m)}>
                        <Text style={[s.metricText, metric === m && s.activeMetricText]}>{METRIC_LABELS[m]}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#00E676" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#00E676" />}
                    ListEmptyComponent={<Text style={s.empty}>No runners yet. Be the first! 🏃</Text>}
                    contentContainerStyle={{ paddingBottom: 90 }}
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0E1A' },
    title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', padding: 16, paddingBottom: 8 },
    tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111827' },
    activeTab: { backgroundColor: '#00E676' },
    tabText: { color: '#8892A4', fontWeight: '600' },
    activeTabText: { color: '#0A0E1A' },
    metricRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12 },
    metricBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1A2030' },
    activeMetric: { backgroundColor: '#1B3A28', borderWidth: 1, borderColor: '#00E676' },
    metricText: { color: '#8892A4', fontSize: 12 },
    activeMetricText: { color: '#00E676' },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1A2030' },
    myRow: { backgroundColor: '#0D2818' },
    rankWrap: { width: 40 },
    rank: { color: '#8892A4', fontSize: 16, fontWeight: 'bold' },
    topRank: { fontSize: 22 },
    info: { flex: 1, marginLeft: 8 },
    name: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    meta: { color: '#8892A4', fontSize: 12, marginTop: 2 },
    value: { color: '#00E676', fontSize: 14, fontWeight: 'bold' },
    empty: { color: '#8892A4', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
