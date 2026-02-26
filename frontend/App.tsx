/**
 * Territory Runner — App Entry Point
 */

import React, { useState, useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { loadAuthState, getUserId, isAuthenticated } from './src/services/authService';

import LoginScreen from './src/screens/LoginScreen';
import RunScreen from './src/screens/RunScreen';
import FeedScreen from './src/screens/FeedScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

type Tab = 'run' | 'feed' | 'leaderboard' | 'profile' | 'settings';

const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: 'run', icon: '🏃', label: 'Run' },
    { key: 'feed', icon: '📢', label: 'Feed' },
    { key: 'leaderboard', icon: '🏆', label: 'Ranks' },
    { key: 'profile', icon: '👤', label: 'Profile' },
    { key: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function App() {
    const [activeTab, setActiveTab] = useState<Tab>('run');
    const [profileUserId, setProfileUserId] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);

    useEffect(() => {
        console.log('[App] Mounting, loading auth state...');
        loadAuthState().then(({ userId }) => {
            console.log('[App] Auth state loaded. UserId:', userId);
            if (userId) {
                setLoggedIn(true);
            }
            setReady(true);
        }).catch(err => {
            console.error('[App] Auth state load error:', err);
            setReady(true); // fall back
        });
    }, []);

    const handleLoginSuccess = (userId: string, username: string) => {
        setLoggedIn(true);
    };

    const viewProfile = (userId: string) => {
        setProfileUserId(userId);
        setActiveTab('profile');
    };

    if (!ready) {
        console.log('[App] Rendering Loading screen');
        return (
            <View style={[styles.loading, { backgroundColor: '#8B0000' }]}>
                <Text style={styles.logo}>🏃</Text>
                <Text style={styles.title}>Territory Runner (LOADING)</Text>
                <ActivityIndicator size="large" color="#00E676" style={styles.loader} />
            </View>
        );
    }

    // Show LoginScreen if not authenticated
    if (!loggedIn) {
        console.log('[App] Rendering LoginScreen');
        return (
            <SafeAreaProvider>
                <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
            </SafeAreaProvider>
        );
    }

    const currentUserId = getUserId() || '';
    console.log('[App] Rendering main app tabs. currentUserId:', currentUserId);

    const renderScreen = () => {
        switch (activeTab) {
            case 'run':
                return <RunScreen userId={currentUserId} />;
            case 'feed':
                return <FeedScreen onViewProfile={viewProfile} />;
            case 'leaderboard':
                return <LeaderboardScreen onViewProfile={viewProfile} />;
            case 'profile':
                return (
                    <ProfileScreen
                        userId={profileUserId || currentUserId}
                        onBack={profileUserId !== currentUserId && profileUserId
                            ? () => { setProfileUserId(null); }
                            : undefined
                        }
                    />
                );
            case 'settings':
                return <SettingsScreen />;
            default:
                return <RunScreen userId={currentUserId} />;
        }
    };

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.screenWrap}>{renderScreen()}</View>

                <View style={styles.tabBar}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabBtn}
                            onPress={() => {
                                if (tab.key === 'profile') setProfileUserId(null);
                                setActiveTab(tab.key);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabIcon, activeTab === tab.key && styles.activeIcon]}>
                                {tab.icon}
                            </Text>
                            <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeLabel]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: '#0A0E1A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        fontSize: 80,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#00E676',
        marginBottom: 30,
    },
    loader: {
        marginTop: 20,
    },
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
    },
    screenWrap: {
        flex: 1,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        borderTopWidth: 1,
        borderColor: '#1A2030',
        paddingBottom: 4,
    },
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    tabIcon: {
        fontSize: 20,
        opacity: 0.5,
    },
    activeIcon: {
        opacity: 1,
    },
    tabLabel: {
        color: '#6B7280',
        fontSize: 10,
        marginTop: 2,
    },
    activeLabel: {
        color: '#00E676',
    },
});
