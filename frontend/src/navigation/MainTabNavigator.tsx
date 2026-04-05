import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import RunScreen from '../screens/RunScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { getUserId } from '../services/authService';

export type MainTabParamList = {
    Home: undefined;
    Map: undefined;
    Leaderboard: undefined;
    Feed: undefined;
    Profile: undefined;
};

interface MainTabNavigatorProps {
    userId: string;
    onLogout: () => Promise<void> | void;
}

const Tab = createBottomTabNavigator<MainTabParamList>();
const ProfileStack = createNativeStackNavigator();

// Tab Icon Component
interface TabIconProps {
    name: string;
    focused: boolean;
    color: string;
}

function TabIcon({ name, focused, color }: TabIconProps) {
    const iconSize = focused ? 28 : 24;
    const iconColor = focused ? '#00FF88' : '#6B7280';

    const iconMap: Record<string, string> = {
        home: '🏠',
        map: '🗺️',
        leaderboard: '🏆',
        feed: '👥',
        profile: '👤',
    };

    return (
        <View style={styles.tabIconContainer}>
            <Text style={{ fontSize: iconSize, color: iconColor }}>
                {iconMap[name] || '?'}
            </Text>
            {focused && <View style={styles.tabIndicator} />}
        </View>
    );
}

function ProfileStackNavigator({ userId, onLogout }: MainTabNavigatorProps) {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const handleViewProfile = useCallback((uid: string) => {
        if (uid !== userId) {
            setSelectedUserId(uid);
        }
    }, [userId]);

    return (
        <ProfileStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0A0E1A' },
            }}
        >
            <ProfileStack.Screen name="Me">
                {() => (
                    <SettingsScreen
                        onLogout={onLogout}
                        userId={userId}
                        onViewProfile={handleViewProfile}
                    />
                )}
            </ProfileStack.Screen>
            {selectedUserId && (
                <ProfileStack.Screen
                    name="ViewProfile"
                    options={{ title: 'Profile' }}
                >
                    {() => (
                        <ProfileScreen
                            userId={selectedUserId}
                            onBack={() => setSelectedUserId(null)}
                        />
                    )}
                </ProfileStack.Screen>
            )}
        </ProfileStack.Navigator>
    );
}

export default function MainTabNavigator({ userId, onLogout }: MainTabNavigatorProps) {
    const [selectedUserInLeaderboard, setSelectedUserInLeaderboard] = useState<string | null>(null);
    const [selectedUserInFeed, setSelectedUserInFeed] = useState<string | null>(null);

    const handleLeaderboardViewProfile = useCallback((uid: string) => {
        if (uid !== userId) {
            setSelectedUserInLeaderboard(uid);
        }
    }, [userId]);

    const handleFeedViewProfile = useCallback((uid: string) => {
        if (uid !== userId) {
            setSelectedUserInFeed(uid);
        }
    }, [userId]);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color }) => (
                    <TabIcon
                        name={route.name.toLowerCase()}
                        focused={focused}
                        color={color}
                    />
                ),
                tabBarLabel: ({ focused }) => (
                    <Text
                        style={[
                            styles.tabLabel,
                            { color: focused ? '#00FF88' : '#6B7280' },
                        ]}
                    >
                        {route.name}
                    </Text>
                ),
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#00FF88',
                tabBarInactiveTintColor: '#6B7280',
                lazy: true,
            })}
        >
            <Tab.Screen
                name="Home"
                options={{ title: 'Home' }}
            >
                {() => <HomeScreen userId={userId} />}
            </Tab.Screen>

            <Tab.Screen
                name="Map"
                options={{ title: 'Map' }}
            >
                {() => <RunScreen userId={userId} />}
            </Tab.Screen>

            <Tab.Screen
                name="Leaderboard"
                options={{ title: 'Leaderboard' }}
            >
                {() => (
                    selectedUserInLeaderboard ? (
                        <ProfileScreen
                            userId={selectedUserInLeaderboard}
                            onBack={() => setSelectedUserInLeaderboard(null)}
                        />
                    ) : (
                        <LeaderboardScreen onViewProfile={handleLeaderboardViewProfile} />
                    )
                )}
            </Tab.Screen>

            <Tab.Screen
                name="Feed"
                options={{ title: 'Feed' }}
            >
                {() => (
                    selectedUserInFeed ? (
                        <ProfileScreen
                            userId={selectedUserInFeed}
                            onBack={() => setSelectedUserInFeed(null)}
                        />
                    ) : (
                        <FeedScreen onViewProfile={handleFeedViewProfile} />
                    )
                )}
            </Tab.Screen>

            <Tab.Screen
                name="Profile"
                options={{ title: 'Profile' }}
            >
                {() => <ProfileStackNavigator userId={userId} onLogout={onLogout} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0C1425',
        borderTopColor: '#1E293B',
        borderTopWidth: 1,
        height: 70,
        paddingBottom: 8,
        paddingTop: 8,
    },
    tabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        width: 40,
    },
    tabIndicator: {
        position: 'absolute',
        bottom: -8,
        left: '50%',
        marginLeft: -3,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00FF88',
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 0,
        marginBottom: 0,
    },
});
