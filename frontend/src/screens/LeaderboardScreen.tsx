/**
 * LeaderboardScreen — Rankings by territory, distance, or XP.
 * Enhanced UI with color-coded medal system, tabs, and metric filters.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { getLeaderboard, getFriendsLeaderboard } from '../services/apiService';
import { getUserId } from '../services/authService';
import { useGlobalSettings } from '../context/GlobalSettingsContext';
import { convertDistance } from '../utils/distanceUnits';

const TABS = ['Global', 'City', 'Friends'] as const;
const METRICS = ['territory', 'distance', 'xp'] as const;

const METRIC_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    territory: { label: 'Territory', icon: '🗺️', color: '#00FF88' },
    distance:  { label: 'Distance',  icon: '🏃', color: '#00B4FF' },
    xp:        { label: 'XP',        icon: '⭐', color: '#FFD700' },
};

const RANK_BADGES = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen({ onViewProfile }: { onViewProfile?: (id: string) => void }) {
    const [tab, setTab] = useState<typeof TABS[number]>('Global');
    const [metric, setMetric] = useState<typeof METRICS[number]>('territory');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { settings } = useGlobalSettings();

    const load = useCallback(async () => {
        try {
            let result;
            if (tab === 'Friends') {
                const myId = getUserId();
                if (myId) result = await getFriendsLeaderboard(myId, metric);
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
    }, [tab, metric]);

    useEffect(() => { setLoading(true); load(); }, [tab, metric, load]);

    const getMetricValue = (item: any) => {
        if (metric === 'territory') return `${((item.total_territory_sqm || 0) / 1000).toFixed(1)}k sqm`;
        if (metric === 'distance') return convertDistance(item.total_distance_m || 0, settings.distanceUnit);
        return `${item.xp || 0} XP`;
    };

    const activeMetricColor = METRIC_CONFIG[metric]?.color ?? '#00FF88';

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const isMe = item.id === getUserId();
        const rankNum = item.rank as number;
        const isTop3 = rankNum <= 3;
        const rankColor = isTop3 ? RANK_COLORS[rankNum - 1] : '#475569';

        return (
            <TouchableOpacity
                style={[s.row, isMe && s.myRow, isTop3 && s.topRow]}
                onPress={() => onViewProfile?.(item.id)}
                activeOpacity={0.7}
            >
                {/* Rank */}
                <View style={s.rankWrap}>
                    {isTop3 ? (
                        <Text style={s.rankBadge}>{RANK_BADGES[rankNum - 1]}</Text>
                    ) : (
                        <View style={[s.rankCircle, { borderColor: rankColor + '50' }]}>
                            <Text style={[s.rankNum, { color: rankColor }]}>#{rankNum}</Text>
                        </View>
                    )}
                </View>

                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: isMe ? '#003320' : '#0D1827', borderColor: isMe ? '#00FF88' : '#1E293B' }]}>
                    <Text style={s.avatarLetter}>
                        {(item.display_name || item.username)?.[0]?.toUpperCase() || '?'}
                    </Text>
                </View>

                {/* Info */}
                <View style={s.info}>
                    <Text style={[s.name, isMe && s.myName]} numberOfLines={1}>
                        {item.display_name || item.username}
                        {isMe ? ' — You' : ''}
                    </Text>
                    <Text style={s.meta}>Lv {item.level}  •  {item.city || 'India'}</Text>
                </View>

                {/* Value */}
                <View style={s.valueWrap}>
                    <Text style={[s.value, { color: activeMetricColor }]}>{getMetricValue(item)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>🏆 Leaderboard</Text>
                <Text style={s.headerSub}>Top runners worldwide</Text>
            </View>

            {/* Tab selector */}
            <View style={s.tabRow}>
                {TABS.map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[s.tab, tab === t && s.activeTab]}
                        onPress={() => setTab(t)}
                    >
                        <Text style={[s.tabText, tab === t && s.activeTabText]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Metric selector */}
            <View style={s.metricRow}>
                {METRICS.map((m) => {
                    const cfg = METRIC_CONFIG[m];
                    return (
                        <TouchableOpacity
                            key={m}
                            style={[s.metricBtn, metric === m && { backgroundColor: cfg.color + '20', borderColor: cfg.color + '60' }]}
                            onPress={() => setMetric(m)}
                        >
                            <Text style={s.metricIcon}>{cfg.icon}</Text>
                            <Text style={[s.metricText, metric === m && { color: cfg.color, fontWeight: '700' }]}>
                                {cfg.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* List */}
            {loading ? (
                <View style={s.loadingWrap}>
                    <ActivityIndicator size="large" color="#00FF88" />
                    <Text style={s.loadingText}>Fetching rankings...</Text>
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor="#00FF88"
                        />
                    }
                    ListEmptyComponent={
                        <View style={s.emptyWrap}>
                            <Text style={s.emptyIcon}>🏁</Text>
                            <Text style={s.empty}>No runners yet. Be the first! 🏃</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#040810' },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#0F1A2A',
    },
    headerTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '900' },
    headerSub: { color: '#475569', fontSize: 12, marginTop: 2 },
    tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingVertical: 12 },
    tab: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#0A1220',
        borderWidth: 1,
        borderColor: '#1E293B',
        alignItems: 'center',
    },
    activeTab: { backgroundColor: '#00FF88', borderColor: '#00FF88' },
    tabText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
    activeTabText: { color: '#030F06' },
    metricRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
    metricBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#0A1220',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    metricIcon: { fontSize: 13 },
    metricText: { color: '#64748B', fontSize: 12 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#475569', fontSize: 13 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#0F1A2A',
        gap: 10,
    },
    myRow: { backgroundColor: 'rgba(0,255,136,0.06)' },
    topRow: { backgroundColor: 'rgba(255,215,0,0.03)' },
    rankWrap: { width: 44, alignItems: 'center' },
    rankBadge: { fontSize: 26 },
    rankCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    rankNum: { fontSize: 11, fontWeight: '800' },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: { fontSize: 16, fontWeight: '800', color: '#94A3B8' },
    info: { flex: 1 },
    name: { color: '#E2E8F0', fontSize: 14, fontWeight: '700' },
    myName: { color: '#00FF88' },
    meta: { color: '#475569', fontSize: 11, marginTop: 2 },
    valueWrap: { alignItems: 'flex-end' },
    value: { fontSize: 14, fontWeight: '800' },
    emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyIcon: { fontSize: 40 },
    empty: { color: '#475569', fontSize: 14 },
});
