import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import type {
    AuthStackParamList,
    VerifiedAuthPayload,
} from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthStackNavigatorProps {
    onLoginSuccess: (userId: string, username: string) => Promise<void> | void;
    onOtpVerified: (verified: VerifiedAuthPayload) => Promise<void> | void;
}

export default function AuthStackNavigator({
    onLoginSuccess,
    onOtpVerified,
}: AuthStackNavigatorProps) {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerStyle: { backgroundColor: '#0A1020' },
                headerTitleStyle: { color: '#F3F4F6', fontWeight: '700' },
                headerTintColor: '#F3F4F6',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#060B16' },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="Login" options={{ title: 'Log In' }}>
                {(props) => (
                    <LoginScreen
                        {...props}
                        onLoginSuccess={onLoginSuccess}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="SignUp" options={{ title: 'Create Account' }}>
                {(props) => (
                    <SignUpScreen
                        {...props}
                    />
                )}
            </Stack.Screen>
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Forgot Password' }}
            />
            <Stack.Screen name="EmailVerification" options={{ title: 'Verify Email' }}>
                {(props) => (
                    <EmailVerificationScreen
                        {...props}
                        onOtpVerified={onOtpVerified}
                    />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
}
