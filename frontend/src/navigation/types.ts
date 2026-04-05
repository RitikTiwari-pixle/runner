import type { NavigatorScreenParams } from '@react-navigation/native';

export interface VerifiedAuthPayload {
    userId: string;
    username: string;
}

export type AuthStackParamList = {
    Login: { prefillIdentifier?: string } | undefined;
    SignUp: { prefillIdentifier?: string } | undefined;
    ForgotPassword: { prefillEmail?: string } | undefined;
    EmailVerification: {
        flow: 'signup' | 'forgot';
        email?: string;
    };
};

export type OnboardingStackParamList = {
    Permissions: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Map: undefined;
    Leaderboard: undefined;
    Feed: undefined;
    Profile: undefined;
};

export type MainStackParamList = {
    Run: undefined;
};

export type RootStackParamList = {
    Splash: undefined;
    Welcome: undefined;
    Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
    Onboarding: NavigatorScreenParams<OnboardingStackParamList> | undefined;
    Main: NavigatorScreenParams<MainTabParamList> | undefined;
};
