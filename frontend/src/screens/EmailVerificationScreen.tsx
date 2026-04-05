import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '../services/apiService';
import { saveAuthState } from '../services/authService';
import type { AuthStackParamList, VerifiedAuthPayload } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailVerification'> & {
    onOtpVerified: (verified: VerifiedAuthPayload) => Promise<void> | void;
};

export default function EmailVerificationScreen({ navigation, route, onOtpVerified }: Props) {
    const { flow, email } = route.params;
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendCooldownS, setResendCooldownS] = useState(60);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const codeFocused = useRef(false);

    const otpPurpose = useMemo<'signup' | 'password_reset'>(
        () => (flow === 'signup' ? 'signup' : 'password_reset'),
        [flow],
    );

    useEffect(() => {
        if (resendCooldownS <= 0) return;
        const timer = setInterval(() => {
            setResendCooldownS((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldownS]);

    const formatCooldown = (s: number) => {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, '0')}`;
    };

    const handleVerify = async () => {
        const trimmedCode = code.replace(/\s/g, '');
        if (!/^\d{6}$/.test(trimmedCode)) { setError('Enter the 6-digit verification code.'); return; }
        if (!email) { setError('Email session missing. Please restart the flow.'); return; }
        if (flow === 'forgot') {
            if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
            if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
        }
        setVerifying(true);
        setError(null);
        setNotice(null);
        try {
            const result = await api.verifyLocalOtp(email, trimmedCode, otpPurpose, flow === 'forgot' ? newPassword : undefined);
            if (flow === 'signup') {
                await saveAuthState(result.user_id, result.token, result.username);
                await onOtpVerified({ userId: result.user_id, username: result.username });
                return;
            }
            setNotice('Password reset successful. Please log in with your new password.');
            navigation.reset({ index: 0, routes: [{ name: 'Login', params: { prefillIdentifier: email } }] });
        } catch (err: any) {
            setError(api.getApiErrorMessage(err, 'Unable to verify code right now.'));
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldownS > 0) return;
        if (!email) { setError('Email session missing. Please restart the flow.'); return; }
        setResending(true);
        setError(null);
        setNotice(null);
        try {
            const response = await api.resendLocalOtp(email, otpPurpose);
            setNotice(response.message);
            setResendCooldownS(60);
        } catch (err: any) {
            setError(api.getApiErrorMessage(err, 'Failed to resend verification code.'));
        } finally {
            setResending(false);
        }
    };

    const codeDigits = code.padEnd(6, '·').split('');

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.orbA} />
            <View style={styles.orbB} />

            <View style={styles.inner}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconWrap}>
                        <Text style={styles.icon}>✉️</Text>
                    </View>
                    <Text style={styles.title}>
                        {flow === 'signup' ? 'Verify Your Email' : 'Reset Password'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {flow === 'signup'
                            ? 'Enter the 6-digit code sent to your email to confirm your account.'
                            : 'Enter the verification code and set your new password.'}
                    </Text>
                    {email && (
                        <View style={styles.emailBadge}>
                            <Text style={styles.emailBadgeText}>📧 {email}</Text>
                        </View>
                    )}
                </View>

                {/* OTP Display + Hidden input */}
                <View style={styles.codeSection}>
                    <Text style={styles.codeLabel}>VERIFICATION CODE</Text>
                    <View style={styles.codeBoxes}>
                        {codeDigits.map((d, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.codeBox,
                                    i < code.length && styles.codeBoxFilled,
                                    i === code.length && styles.codeBoxActive,
                                ]}
                            >
                                <Text style={[styles.codeDigit, d === '·' && styles.codeDigitEmpty]}>
                                    {d}
                                </Text>
                            </View>
                        ))}
                    </View>
                    {/* Real input for OTP - styled to be invisible but fully functional */}
                    <TextInput
                        style={styles.otpInput}
                        value={code}
                        onChangeText={(val) => {
                            const normalized = val.replace(/[^0-9]/g, '').slice(0, 6);
                            setCode(normalized);
                            setError(null);
                            if (normalized.length === 6) Keyboard.dismiss();
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                        autoComplete="one-time-code"
                        importantForAutofill="yes"
                        textContentType="oneTimeCode"
                    />
                </View>

                {/* Additional fields for password reset */}
                {flow === 'forgot' && (
                    <View style={styles.fieldsSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>🔒 NEW PASSWORD</Text>
                            <View style={styles.inputWrap}>
                                <TextInput
                                    style={styles.input}
                                    value={newPassword}
                                    onChangeText={(v) => { setNewPassword(v); setError(null); }}
                                    placeholder="Minimum 8 characters"
                                    placeholderTextColor="#4A5568"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                />
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>🔒 CONFIRM PASSWORD</Text>
                            <View style={styles.inputWrap}>
                                <TextInput
                                    style={styles.input}
                                    value={confirmPassword}
                                    onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
                                    placeholder="Re-enter new password"
                                    placeholderTextColor="#4A5568"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* Error / Notice */}
                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}
                {notice && (
                    <View style={styles.noticeBox}>
                        <Text style={styles.noticeIcon}>✅</Text>
                        <Text style={styles.noticeText}>{notice}</Text>
                    </View>
                )}

                {/* Actions */}
                <TouchableOpacity
                    style={[styles.primaryButton, (verifying || code.length < 6) && styles.primaryButtonDim]}
                    onPress={handleVerify}
                    disabled={verifying}
                    activeOpacity={0.85}
                >
                    {verifying ? (
                        <ActivityIndicator color="#030F06" />
                    ) : (
                        <Text style={styles.primaryText}>
                            {flow === 'signup' ? '✓  VERIFY & ENTER APP' : '✓  RESET PASSWORD'}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.resendButton, (resending || resendCooldownS > 0) && styles.resendButtonDisabled]}
                    onPress={handleResend}
                    disabled={resending || resendCooldownS > 0}
                    activeOpacity={0.75}
                >
                    {resendCooldownS > 0 ? (
                        <Text style={styles.resendText}>
                            Resend in <Text style={styles.resendTimer}>{formatCooldown(resendCooldownS)}</Text>
                        </Text>
                    ) : (
                        <Text style={[styles.resendText, styles.resendActive]}>
                            {resending ? 'Resending...' : '↻  Resend Code'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#040810',
        justifyContent: 'center',
        paddingHorizontal: 22,
    },
    orbA: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(0,255,136,0.09)',
    },
    orbB: {
        position: 'absolute',
        bottom: -60,
        left: -80,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(0,100,255,0.07)',
    },
    inner: {
        backgroundColor: 'rgba(10,16,30,0.97)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 20,
        paddingVertical: 26,
        overflow: 'hidden',
    },
    header: { alignItems: 'center', marginBottom: 22 },
    iconWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(0,255,136,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(0,255,136,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    icon: { fontSize: 30 },
    title: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
    subtitle: { color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
    emailBadge: {
        backgroundColor: 'rgba(0,255,136,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.3)',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    emailBadgeText: { color: '#DBFCE7', fontSize: 12, fontWeight: '700' },
    codeSection: { marginBottom: 18, alignItems: 'center' },
    codeLabel: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
    codeBoxes: { flexDirection: 'row', gap: 8 },
    codeBox: {
        width: 44,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#080E1C',
        borderWidth: 1.5,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    codeBoxFilled: { borderColor: '#00FF88', backgroundColor: 'rgba(0,255,136,0.08)' },
    codeBoxActive: { borderColor: '#00FF88', borderStyle: 'dashed' },
    codeDigit: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
    codeDigitEmpty: { color: '#2D3748', fontSize: 20 },
    otpInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        zIndex: 10,
    },
    fieldsSection: { marginBottom: 4 },
    inputGroup: { marginBottom: 14 },
    inputLabel: { color: '#94A3B8', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7, fontWeight: '700' },
    inputWrap: { backgroundColor: '#080E1C', borderRadius: 13, borderWidth: 1.5, borderColor: '#1E293B' },
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
    noticeBox: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.35)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    noticeIcon: { fontSize: 14 },
    noticeText: { flex: 1, color: '#6EE7B7', fontSize: 13 },
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
    primaryButtonDim: { opacity: 0.6 },
    primaryText: { color: '#030F06', fontWeight: '900', letterSpacing: 1.5, fontSize: 13 },
    resendButton: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
    resendButtonDisabled: { opacity: 0.5 },
    resendText: { color: '#475569', fontSize: 13, fontWeight: '600' },
    resendActive: { color: '#00FF88' },
    resendTimer: { color: '#94A3B8', fontWeight: '800' },
});
