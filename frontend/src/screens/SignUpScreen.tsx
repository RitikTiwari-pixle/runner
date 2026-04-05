import React, { useMemo, useState } from 'react';
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
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deriveUsername(rawEmail: string): string {
    const localPart = rawEmail.split('@')[0] || '';
    const sanitized = localPart.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const compact = sanitized.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
    const fallback = compact.length > 0 ? compact : 'runner';
    const result = fallback.slice(0, 30);
    return result.length >= 3 ? result : `${result.padEnd(3, '0')}`;
}

function isValidUsername(username: string): boolean {
    return username.length >= 3 && username.length <= 30 && /^[a-z0-9_]+$/.test(username);
}

interface InputProps {
    label: string;
    icon: string;
    placeholder: string;
    value: string;
    onChangeText: (value: string) => void;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    hint?: string;
}

function LabeledInput({
    label, icon, placeholder, value, onChangeText, secureTextEntry = false,
    keyboardType = 'default', autoCapitalize = 'sentences', hint,
}: InputProps) {
    const [focused, setFocused] = useState(false);
    return (
        <View style={inputStyles.group}>
            <Text style={inputStyles.label}>{icon}  {label}</Text>
            <View style={[inputStyles.wrap, focused && inputStyles.wrapFocused]}>
                <TextInput
                    value={value}
                    placeholder={placeholder}
                    placeholderTextColor="#4A5568"
                    style={inputStyles.input}
                    onChangeText={onChangeText}
                    secureTextEntry={secureTextEntry}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={false}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
            </View>
            {hint ? <Text style={inputStyles.hint}>{hint}</Text> : null}
        </View>
    );
}

const inputStyles = StyleSheet.create({
    group: { marginBottom: 16 },
    label: { color: '#94A3B8', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7, fontWeight: '700' },
    wrap: { backgroundColor: '#080E1C', borderRadius: 13, borderWidth: 1.5, borderColor: '#1E293B', overflow: 'hidden' },
    wrapFocused: { borderColor: '#00FF88', shadowColor: '#00FF88', shadowOpacity: 0.15, shadowRadius: 8 },
    input: { color: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
    hint: { marginTop: 4, color: '#475569', fontSize: 11 },
});

export default function SignUpScreen({ navigation, route }: Props) {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (route.params?.prefillIdentifier) {
            const prefill = route.params.prefillIdentifier;
            if (prefill.includes('@')) {
                setEmail(prefill);
            } else {
                setUsername(prefill);
            }
        }
    }, [route.params?.prefillIdentifier]);

    const suggestedUsername = useMemo(() => deriveUsername(email.trim().toLowerCase()), [email]);

    const handleCreateAccount = async () => {
        setError(null);
        const trimmedEmail = email.trim().toLowerCase();
        const normalizedUsername = (username.trim().toLowerCase() || suggestedUsername).slice(0, 30);
        const trimmedDisplay = displayName.trim() || normalizedUsername;

        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
            setError('Enter a valid email address.');
            return;
        }
        if (!isValidUsername(normalizedUsername)) {
            setError('Username must be 3-30 chars: letters, numbers, or underscore.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await api.registerLocal(trimmedEmail, normalizedUsername, password, trimmedDisplay);
            navigation.navigate('EmailVerification', { flow: 'signup', email: trimmedEmail });
        } catch (err: any) {
            const message = api.getApiErrorMessage(err, 'Account creation failed.');
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
                        <View style={styles.pill}>
                            <Text style={styles.pillText}>🏃 JOIN THE MISSION</Text>
                        </View>
                        <Text style={styles.title}>Create{'\n'}Account</Text>
                        <View style={styles.accentBar} />
                        <Text style={styles.subtitle}>
                            Build your runner profile and start conquering territory.
                        </Text>
                    </View>

                    {/* Progress indicator */}
                    <View style={styles.progressRow}>
                        <View style={styles.progressStep}>
                            <View style={[styles.progressCircle, styles.progressCircleActive]}>
                                <Text style={styles.progressCircleText}>1</Text>
                            </View>
                            <Text style={[styles.progressLabel, styles.progressLabelActive]}>Profile</Text>
                        </View>
                        <View style={styles.progressLine} />
                        <View style={styles.progressStep}>
                            <View style={styles.progressCircle}>
                                <Text style={styles.progressCircleText}>2</Text>
                            </View>
                            <Text style={styles.progressLabel}>Verify</Text>
                        </View>
                        <View style={styles.progressLine} />
                        <View style={styles.progressStep}>
                            <View style={styles.progressCircle}>
                                <Text style={styles.progressCircleText}>3</Text>
                            </View>
                            <Text style={styles.progressLabel}>Run!</Text>
                        </View>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.formGlow} />
                        <LabeledInput
                            label="Email"
                            icon="✉️"
                            value={email}
                            placeholder="you@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            onChangeText={(value) => { setEmail(value); setError(null); }}
                        />
                        <LabeledInput
                            label="Username"
                            icon="🎖️"
                            value={username}
                            placeholder={suggestedUsername || 'your_username'}
                            autoCapitalize="none"
                            hint="3-30 characters, letters, numbers, underscore"
                            onChangeText={(value) => { setUsername(value); setError(null); }}
                        />
                        <LabeledInput
                            label="Display Name"
                            icon="✏️"
                            value={displayName}
                            placeholder="How others will see you"
                            onChangeText={(value) => { setDisplayName(value); setError(null); }}
                        />
                        <LabeledInput
                            label="Password"
                            icon="🔒"
                            value={password}
                            placeholder="Minimum 8 characters"
                            secureTextEntry
                            autoCapitalize="none"
                            onChangeText={(value) => { setPassword(value); setError(null); }}
                        />
                        <LabeledInput
                            label="Confirm Password"
                            icon="🔒"
                            value={confirmPassword}
                            placeholder="Re-enter password"
                            secureTextEntry
                            autoCapitalize="none"
                            onChangeText={(value) => { setConfirmPassword(value); setError(null); }}
                        />

                        {error ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorIcon}>⚠️</Text>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.disabledButton]}
                            onPress={handleCreateAccount}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#030F06" />
                            ) : (
                                <Text style={styles.primaryButtonText}>✓  CREATE & VERIFY</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => navigation.navigate('Login')}
                            style={styles.linkButton}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.linkText}>Already have an account?{' '}
                                <Text style={styles.linkTextAccent}>Log In →</Text>
                            </Text>
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
        top: -60,
        right: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(0,180,255,0.1)',
    },
    orbB: {
        position: 'absolute',
        bottom: -80,
        left: -60,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(0,255,136,0.08)',
    },
    scroll: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 24 },
    header: { marginBottom: 20 },
    pill: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0,255,136,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0,255,136,0.3)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 14,
    },
    pillText: { color: '#00FF88', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    title: { color: '#F8FAFC', fontSize: 36, lineHeight: 40, fontWeight: '900' },
    accentBar: { marginTop: 10, height: 3, width: 60, backgroundColor: '#00FF88', borderRadius: 2 },
    subtitle: { marginTop: 10, color: '#64748B', fontSize: 14, lineHeight: 20 },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    progressStep: { alignItems: 'center', gap: 4 },
    progressCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#111827',
        borderWidth: 1.5,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressCircleActive: {
        backgroundColor: '#00FF88',
        borderColor: '#00FF88',
    },
    progressCircleText: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
    progressLine: { flex: 1, height: 1.5, backgroundColor: '#1E293B', marginBottom: 18 },
    progressLabel: { color: '#475569', fontSize: 10 },
    progressLabelActive: { color: '#00FF88' },
    form: {
        backgroundColor: 'rgba(10,16,30,0.95)',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#1E293B',
        paddingHorizontal: 20,
        paddingVertical: 22,
        overflow: 'hidden',
    },
    formGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#00B4FF',
        opacity: 0.5,
    },
    errorBox: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.4)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
    },
    errorIcon: { fontSize: 14 },
    errorText: { flex: 1, color: '#FCA5A5', fontSize: 13, lineHeight: 18 },
    primaryButton: {
        backgroundColor: '#00FF88',
        borderRadius: 14,
        alignItems: 'center',
        paddingVertical: 16,
        marginTop: 4,
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    disabledButton: { opacity: 0.65 },
    primaryButtonText: { color: '#030F06', fontWeight: '900', letterSpacing: 1.8, fontSize: 14 },
    linkButton: { marginTop: 16, alignItems: 'center' },
    linkText: { color: '#475569', fontSize: 13 },
    linkTextAccent: { color: '#00FF88', fontWeight: '700' },
});
