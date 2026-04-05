import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PermissionsScreen from '../screens/PermissionsScreen';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

interface OnboardingStackNavigatorProps {
    onPermissionsGranted: () => Promise<void> | void;
}

export default function OnboardingStackNavigator({
    onPermissionsGranted,
}: OnboardingStackNavigatorProps) {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0A0E1A' },
            }}
        >
            <Stack.Screen name="Permissions">
                {() => <PermissionsScreen onPermissionsGranted={onPermissionsGranted} />}
            </Stack.Screen>
        </Stack.Navigator>
    );
}
