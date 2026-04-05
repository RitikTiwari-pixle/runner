import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
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
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
    const initial = useMemo(() => route.params?.prefillEmail ?? '', [route.params?.prefillEmail]);
    const [email, setEmail] = useState(initial);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [focused, setFocused] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0));
    const slideAnim = useRef(new Animated.Value(28));

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim.current, { toValue: 1, duration: 550, useNativeDriver: true }),
            Animated.timing(slideAnim.current, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const handleSubmit = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
            setError('Enter a valid email address.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await api.requestPasswordResetOtp(trimmedEmail);
            navigation.navigate('EmailVerification', { flow: 'forgot', email: trimmedEmail });
        } catch (err: any) {
            setError(api.getApiErrorMessage(err, 'Unable to request reset code right now.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.orbA} />
            <View style={styles.orbB} />

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.panel}>
                    {/* Icon */}
                    <View style={styles.iconCircle}>
                        <Text style={styles.iconText}>🔑</Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Enter your account email and we'll send you a verification code to reset your password.
                    </Text>

                    {/* Steps */}
                    <View style={styles.stepsRow}>
                        <View style={styles.step}>
                            <View style={[styles.stepNum, styles.stepNumActive]}>
                                <Text style={styles.stepNumText}>1</Text>
                            </View>
                            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Enter Email</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.step}>
                            <View style={styles.stepNum}>
                                <Text style={styles.stepNumText}>2</Text>
                            </View>
                            <Text style={styles.stepLabel}>Verify Code</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.step}>
                            <View style={styles.stepNum}>
                                <Text style={styles.stepNumText}>3</Text>
                            </View>
                            <Text style={styles.stepLabel}>New Password</Text>
                        </View>
                    </View>

                    {/* Email input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>✉️  EMAIL ADDRESS</Text>
                        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={(v) => { setEmail(v); setError(null); }}
                                placeholder="you@example.com"
                                placeholderTextColor="#4A5568"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                            />
                        </View>
                    </View>

                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorIcon}>⚠️</Text>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.primaryButtonDim]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#030F06" />
                        ) : (
                            <Text style={styles.primaryButtonText}>✉️  SEND VERIFICATION CODE</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.navigate('Login', { prefillIdentifier: email })}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.backButtonText}>← Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#040810' },
    orbA: {
        position: 'absolute',
        top: -70,
        right: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(0,255,136,0.09)',
    },
    orbB: {
        position: 'absolute',
        bottom: -60,
        left: -70,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(0,100,255,0.07)',
    },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 30 },
    panel: {
        backgroundColor: 'rgba(10,16,30,0.97)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 20,
        paddingVertical: 26,
    },
    iconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(0,255,136,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(0,255,136,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 18,
    },
    iconText: { fontSize: 30 },
    title: { color: '#F8FAFC', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
    subtitle: { color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
    stepsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 22,
        paddingHorizontal: 4,
    },
    step: { alignItems: 'center', gap: 4 },
    stepNum: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#0A1220',
        borderWidth: 1.5,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumActive: { backgroundColor: '#00FF88', borderColor: '#00FF88' },
    stepNumText: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
    stepLine: { flex: 1, height: 1.5, backgroundColor: '#1E293B', marginBottom: 16 },
    stepLabel: { color: '#475569', fontSize: 9, fontWeight: '600' },
    stepLabelActive: { color: '#00FF88' },
    inputGroup: { marginBottom: 14 },
    label: { color: '#94A3B8', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7, fontWeight: '700' },
    inputWrap: {
        backgroundColor: '#080E1C',
        borderRadius: 13,
        borderWidth: 1.5,
        borderColor: '#1E293B',
    },
    inputWrapFocused: { borderColor: '#00FF88' },
    input: { color: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
    errorBox: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.4)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    errorIcon: { fontSize: 14 },
    errorText: { flex: 1, color: '#FCA5A5', fontSize: 13 },
    primaryButton: {
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
    primaryButtonDim: { opacity: 0.65 },
    primaryButtonText: { color: '#030F06', fontWeight: '900', letterSpacing: 1.2, fontSize: 13 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#1E293B' },
    dividerText: { color: '#475569', fontSize: 11 },
    backButton: { alignItems: 'center', paddingVertical: 8 },
    backButtonText: { color: '#00FF88', fontSize: 13, fontWeight: '700' },
});
