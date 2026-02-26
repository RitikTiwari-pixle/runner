/**
 * LoginScreen — Registration/Login screen for Territory Runner.
 *
 * In dev mode (SKIP_AUTH=true on backend), uses the dev-register endpoint
 * which creates users without Firebase authentication.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import * as api from '../services/apiService';
import { saveAuthState } from '../services/authService';

interface Props {
    onLoginSuccess: (userId: string, username: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async () => {
        const trimmedUsername = username.trim().toLowerCase();
        if (!trimmedUsername) {
            setError('Username is required');
            return;
        }
        if (trimmedUsername.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await api.devRegister(
                trimmedUsername,
                displayName.trim() || trimmedUsername,
                city.trim() || undefined,
                state.trim() || undefined,
            );

            // Save auth state
            await saveAuthState(result.user_id, 'dev-token', result.username);

            onLoginSuccess(result.user_id, result.username);
        } catch (err: any) {
            const msg = err?.response?.data?.detail || err.message || 'Registration failed';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.emoji}>🏃</Text>
                    <Text style={styles.title}>TERRITORY</Text>
                    <Text style={styles.titleSub}>RUNNER</Text>
                    <Text style={styles.tagline}>Capture your city, one run at a time</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Text style={styles.formTitle}>Create Your Account</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. speedrunner_99"
                            placeholderTextColor="#555"
                            value={username}
                            onChangeText={(t) => { setUsername(t); setError(null); }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={30}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Display Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Your public name"
                            placeholderTextColor="#555"
                            value={displayName}
                            onChangeText={setDisplayName}
                            maxLength={100}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>City</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Mumbai"
                                placeholderTextColor="#555"
                                value={city}
                                onChangeText={setCity}
                                maxLength={100}
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>State</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Maharashtra"
                                placeholderTextColor="#555"
                                value={state}
                                onChangeText={setState}
                                maxLength={50}
                            />
                        </View>
                    </View>

                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#0A0E1A" />
                        ) : (
                            <Text style={styles.buttonText}>🚀 START RUNNING</Text>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.footerText}>
                        Join thousands of runners across India 🇮🇳
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    emoji: {
        fontSize: 72,
        marginBottom: 12,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#00FF88',
        letterSpacing: 6,
    },
    titleSub: {
        fontSize: 32,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 6,
        marginTop: -4,
    },
    tagline: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 12,
        letterSpacing: 1,
    },
    form: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1F2937',
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 6,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#374151',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#00FF88',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0A0E1A',
        letterSpacing: 2,
    },
    footerText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 16,
    },
});
