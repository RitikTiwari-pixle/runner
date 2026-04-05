import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '../services/apiService';
import { saveAuthState } from '../services/authService';
import { signInWithGoogle } from '../services/googleAuthService';
import type { AuthStackParamList } from '../navigation/types';

// Debug: Show what API URL we're using
console.log(`[LoginScreen] API_BASE_URL: ${api.API_BASE_URL}`);

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'> & {
    onLoginSuccess: (userId: string, username: string) => Promise<void> | void;
};

export default function LoginScreen({ navigation, route, onLoginSuccess }: Props) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [identifierFocused, setIdentifierFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    React.useEffect(() => {
        if (route.params?.prefillIdentifier) {
            setIdentifier(route.params.prefillIdentifier);
        }
    }, [route.params?.prefillIdentifier]);

    const handleLogin = async () => {
        setError(null);
        const normalizedIdentifier = identifier.trim().toLowerCase();
        if (!identifier.trim() || !password) {
            setError('Username/email and password are required.');
            return;
        }
        if (normalizedIdentifier.length < 3) {
            setError('Enter a valid username or email.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        try {
            const result = await api.loginLocal(normalizedIdentifier, password);
            await saveAuthState(result.user_id, result.token, result.username);
            await onLoginSuccess(result.user_id, result.username);
        } catch (err: any) {
            const status = err?.response?.status;
            const message = api.getApiErrorMessage(err, 'Unable to log in.');
            if (status === 403 && /not verified/i.test(message) && normalizedIdentifier.includes('@')) {
                navigation.navigate('EmailVerification', { flow: 'signup', email: normalizedIdentifier });
                return;
            }
            if (status === 401 || status === 404) {
                setError('Account not found. Please create a new account to continue.');
                setTimeout(() => {
                    navigation.navigate('SignUp', { prefillIdentifier: normalizedIdentifier });
                }, 2000);
                return;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            const googleAuth = await signInWithGoogle();
            if (!googleAuth?.idToken) {
                setError('Google sign-in was cancelled or failed.');
                setLoading(false);
                return;
            }

            // Send Google ID token to backend
            const response = await api.googleLogin(googleAuth.idToken);
            
            // Save auth state and proceed
            await saveAuthState(response.user_id, response.token, response.username);
            await onLoginSuccess(response.user_id, response.username);
        } catch (err: any) {
            console.error('[LoginScreen] Google login error:', err);
            const message = api.getApiErrorMessage(err, 'Google sign-in failed. Please try again.');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Background orbs */}
            <View style={styles.orbA} />
            <View style={styles.orbB} />

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.badgeRow}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>🔒 SECURE LOGIN</Text>
                            </View>
                        </View>
                        <Text style={styles.kicker}>RETURN TO THE MAP</Text>
                        <Text style={styles.title}>Welcome{'\n'}Back</Text>
                        <View style={styles.titleAccentBar} />
                        <Text style={styles.subtitle}>
                            Log in and continue defending your territory.
                        </Text>
                    </View>

                    {/* Stats bar */}
                    <View style={styles.statsBar}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>12K+</Text>
                            <Text style={styles.statLabel}>Runners</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>4M+</Text>
                            <Text style={styles.statLabel}>km Covered</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>500+</Text>
                            <Text style={styles.statLabel}>Cities</Text>
                        </View>
                    </View>

                    {/* Form Card */}
                    <View style={styles.formCard}>
                        <View style={styles.formCardGlow} />

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <Text style={styles.labelIcon}>👤 </Text>USERNAME OR EMAIL
                            </Text>
                            <View style={[styles.inputWrap, identifierFocused && styles.inputWrapFocused]}>
                                <TextInput
                                    style={styles.input}
                                    value={identifier}
                                    onChangeText={(value) => { setIdentifier(value); setError(null); }}
                                    placeholder="username or you@example.com"
                                    placeholderTextColor="#4A5568"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    onFocus={() => setIdentifierFocused(true)}
                                    onBlur={() => setIdentifierFocused(false)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <Text style={styles.labelIcon}>🔑 </Text>PASSWORD
                            </Text>
                            <View style={[styles.inputWrap, passwordFocused && styles.inputWrapFocused]}>
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={(value) => { setPassword(value); setError(null); }}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#4A5568"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.forgotWrap}
                            onPress={() => navigation.navigate('ForgotPassword', {
                                prefillEmail: identifier.includes('@') ? identifier : undefined,
                            })}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.forgotText}>Forgot Password? →</Text>
                        </TouchableOpacity>

                        {error ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorIcon}>⚠️</Text>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#030F06" />
                            ) : (
                                <Text style={styles.primaryButtonText}>▶  LOG IN TO MAP</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={handleGoogleLogin}
                            disabled={loading}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.googleButtonText}>🔐 Sign in with Google</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => navigation.navigate('SignUp')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.secondaryButtonText}>+ Create New Account</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#040810',
    },
    orbA: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
    },
    orbB: {
        position: 'absolute',
        bottom: -80,
        left: -70,
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(0, 100, 255, 0.08)',
    },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 22,
        paddingVertical: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 20,
    },
    badgeRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    badge: {
        backgroundColor: 'rgba(0,255,136,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.3)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    badgeText: {
        color: '#00FF88',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    kicker: {
        color: '#00FF88',
        letterSpacing: 2,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    title: {
        color: '#F8FAFC',
        fontSize: 38,
        lineHeight: 42,
        fontWeight: '900',
    },
    titleAccentBar: {
        marginTop: 10,
        height: 3,
        width: 60,
        backgroundColor: '#00FF88',
        borderRadius: 2,
        shadowColor: '#00FF88',
        shadowOpacity: 0.7,
        shadowRadius: 8,
    },
    subtitle: {
        marginTop: 10,
        color: '#64748B',
        fontSize: 14,
        lineHeight: 20,
    },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(12,20,40,0.8)',
        borderWidth: 1,
        borderColor: '#1E293B',
        borderRadius: 14,
        paddingVertical: 12,
        marginBottom: 18,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        color: '#00FF88',
        fontSize: 18,
        fontWeight: '900',
    },
    statLabel: {
        color: '#64748B',
        fontSize: 11,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        backgroundColor: '#1E293B',
    },
    formCard: {
        backgroundColor: 'rgba(10, 16, 30, 0.95)',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 20,
        paddingVertical: 22,
        overflow: 'hidden',
    },
    formCardGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#00FF88',
        opacity: 0.4,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        color: '#94A3B8',
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 7,
        fontWeight: '700',
    },
    labelIcon: {
        fontSize: 10,
    },
    inputWrap: {
        backgroundColor: '#080E1C',
        borderRadius: 13,
        borderWidth: 1.5,
        borderColor: '#1E293B',
        overflow: 'hidden',
    },
    inputWrapFocused: {
        borderColor: '#00FF88',
        shadowColor: '#00FF88',
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    input: {
        color: '#F8FAFC',
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 15,
    },
    forgotWrap: {
        alignSelf: 'flex-end',
        marginBottom: 6,
    },
    forgotText: {
        color: '#00FF88',
        fontSize: 12,
        fontWeight: '600',
    },
    errorBox: {
        marginTop: 4,
        marginBottom: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248, 113, 113, 0.4)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    errorIcon: {
        fontSize: 14,
    },
    errorText: {
        flex: 1,
        color: '#FCA5A5',
        fontSize: 13,
        lineHeight: 18,
    },
    primaryButton: {
        marginTop: 14,
        backgroundColor: '#00FF88',
        borderRadius: 14,
        alignItems: 'center',
        paddingVertical: 16,
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    disabledButton: {
        opacity: 0.65,
    },
    primaryButtonText: {
        color: '#030F06',
        fontWeight: '900',
        letterSpacing: 1.8,
        fontSize: 14,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 14,
        gap: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#1E293B',
    },
    dividerText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
    },
    secondaryButton: {
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#1E3A5A',
        paddingVertical: 14,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#88F7C5',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    googleButton: {
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: '#4A5568',
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    googleButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
