import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabNavigator from './MainTabNavigator';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

interface MainStackNavigatorProps {
    userId: string;
    onLogout: () => Promise<void> | void;
}

export default function MainStackNavigator({ userId, onLogout }: MainStackNavigatorProps) {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0A0E1A' },
            }}
        >
            <Stack.Screen name="Run">
                {() => <MainTabNavigator userId={userId} onLogout={onLogout} />}
            </Stack.Screen>
        </Stack.Navigator>
    );
}
