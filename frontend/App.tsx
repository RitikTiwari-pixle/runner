import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
    DarkTheme,
    NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// enableScreens is optional in newer versions of react-native-screens
// import { enableScreens } from 'react-native-screens';

import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import OnboardingStackNavigator from './src/navigation/OnboardingStackNavigator';
import MainStackNavigator from './src/navigation/MainStackNavigator';
import type {
    RootStackParamList,
    VerifiedAuthPayload,
} from './src/navigation/types';
import {
    clearAuthState,
    loadAuthState,
} from './src/services/authService';
import {
    checkLocationPermissions,
    checkNotificationPermissions,
} from './src/utils/permissions';
import { GlobalSettingsProvider } from './src/context/GlobalSettingsContext';

// enableScreens() is optional in newer versions of react-native-screens
// enableScreens();

const RootStack = createNativeStackNavigator<RootStackParamList>();

type AppStage = 'booting' | 'signedOut' | 'onboarding' | 'main';

interface AuthUserState {
    userId: string;
    username?: string;
}

const NAV_THEME = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: '#050914',
        card: '#0A1020',
        text: '#F8FAFC',
        border: '#111B2E',
    },
};

function AppContent() {
    const [booting, setBooting] = useState(true);
    const [authUser, setAuthUser] = useState<AuthUserState | null>(null);
    const [locationGranted, setLocationGranted] = useState(false);
    const [notificationGranted, setNotificationGranted] = useState(false);

    const refreshPermissionState = useCallback(async () => {
        const location = await checkLocationPermissions();
        setLocationGranted(location.foreground);
        try {
            const notifications = await checkNotificationPermissions();
            setNotificationGranted(notifications);
        } catch {
            setNotificationGranted(false);
        }
    }, []);

    useEffect(() => {
        let alive = true;

        const bootstrap = async () => {
            try {
                const auth = await loadAuthState();
                if (!alive) return;

                if (auth.userId && auth.token) {
                    setAuthUser({ userId: auth.userId });
                    await refreshPermissionState();
                    return;
                }

                setAuthUser(null);
                setLocationGranted(false);
                setNotificationGranted(false);
            } catch (error) {
                console.error('[App] bootstrap failed:', error);
            } finally {
                if (alive) {
                    setBooting(false);
                }
            }
        };

        bootstrap();

        return () => {
            alive = false;
        };
    }, [refreshPermissionState]);

    const handleLoginSuccess = async (userId: string, username: string) => {
        setAuthUser({ userId, username });
        await refreshPermissionState();
    };

    const handleOtpVerified = async (verified: VerifiedAuthPayload) => {
        setAuthUser({
            userId: verified.userId,
            username: verified.username,
        });
        await refreshPermissionState();
    };

    const handlePermissionsGranted = async () => {
        setLocationGranted(true);
        try {
            const notifications = await checkNotificationPermissions();
            setNotificationGranted(notifications);
        } catch {
            setNotificationGranted(notificationGranted);
        }
    };

    const handleLogout = async () => {
        await clearAuthState();
        setAuthUser(null);
        setLocationGranted(false);
        setNotificationGranted(false);
    };

    const stage: AppStage = useMemo(() => {
        if (booting) return 'booting';
        if (!authUser) return 'signedOut';
        if (!locationGranted) return 'onboarding';
        return 'main';
    }, [authUser, booting, locationGranted]);

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#050914" />
            <NavigationContainer theme={NAV_THEME}>
                <RootStack.Navigator
                    key={stage}
                    screenOptions={{
                        headerShown: false,
                        animation: 'fade',
                    }}
                >
                    {stage === 'booting' ? (
                        <RootStack.Screen name="Splash" component={SplashScreen} />
                    ) : null}

                    {stage === 'signedOut' ? (
                        <>
                            <RootStack.Screen name="Welcome" component={WelcomeScreen} />
                            <RootStack.Screen name="Auth">
                                {() => (
                                    <AuthStackNavigator
                                        onLoginSuccess={handleLoginSuccess}
                                        onOtpVerified={handleOtpVerified}
                                    />
                                )}
                            </RootStack.Screen>
                        </>
                    ) : null}

                    {stage === 'onboarding' ? (
                        <RootStack.Screen name="Onboarding">
                            {() => (
                                <OnboardingStackNavigator
                                    onPermissionsGranted={handlePermissionsGranted}
                                />
                            )}
                        </RootStack.Screen>
                    ) : null}

                    {stage === 'main' && authUser ? (
                        <RootStack.Screen name="Main">
                            {() => (
                                <MainStackNavigator
                                    userId={authUser.userId}
                                    onLogout={handleLogout}
                                />
                            )}
                        </RootStack.Screen>
                    ) : null}
                </RootStack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

export default function App() {
    return (
        <GlobalSettingsProvider>
            <AppContent />
        </GlobalSettingsProvider>
    );
}
