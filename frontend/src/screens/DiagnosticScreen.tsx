/**
 * CONNECTION DIAGNOSTIC SCREEN
 * 
 * Add this temporarily to diagnose connection issues.
 * 
 * Usage:
 * 1. Create: frontend/src/screens/DiagnosticScreen.tsx (this file)
 * 2. Add to navigation in MainTabNavigator or anywhere accessible
 * 3. Open screen, check diagnostics
 * 4. Share the info with support
 * 5. Delete file after testing
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from '../services/apiService';
import axios from 'axios';

interface DiagnosticResult {
    name: string;
    status: 'loading' | 'pass' | 'fail' | 'warn';
    message: string;
}

export default function DiagnosticScreen() {
    const [results, setResults] = useState<DiagnosticResult[]>([]);

    useEffect(() => {
        runDiagnostics();
    }, []);

    const runDiagnostics = async () => {
        const diags: DiagnosticResult[] = [];

        // Test 1: API URL Check
        diags.push({
            name: '1. API URL Configuration',
            status: 'pass',
            message: `API_BASE_URL: ${API_BASE_URL}`,
        });

        // Test 2: Backend Reachability
        diags.push({
            name: '2. Backend Reachability',
            status: 'loading',
            message: 'Testing connection to backend...',
        });
        setResults([...diags]);

        try {
            const response = await axios.get(`${API_BASE_URL}/health`, {
                timeout: 5000,
            });
            diags[1] = {
                name: '2. Backend Reachability',
                status: 'pass',
                message: `✅ Backend is reachable (Status: ${response.status})`,
            };
        } catch (error: any) {
            const errMsg = error?.response?.status
                ? `HTTP ${error.response.status}: ${error.response.statusText}`
                : error?.message || 'Unknown error';

            diags[1] = {
                name: '2. Backend Reachability',
                status: 'fail',
                message: `❌ Cannot reach backend: ${errMsg}`,
            };
        }

        // Test 3: Environment Variables
        diags.push({
            name: '3. Environment Variables',
            status: 'pass',
            message: `EXPO_PUBLIC_API_URL: ${process.env.EXPO_PUBLIC_API_URL || '(not set)'}`,
        });

        // Test 4: Network Status
        diags.push({
            name: '4. Network Status',
            status: 'pass',
            message: `Platform: ${require('react-native').Platform.OS}`,
        });

        // Test 5: Last Login Status (check localStorage)
        try {
            const token = await require('@react-native-async-storage/async-storage').default.getItem('@token');
            diags.push({
                name: '5. Authentication Status',
                status: token ? 'pass' : 'warn',
                message: token ? '✅ Token found' : '⚠️ No token (not logged in)',
            });
        } catch {
            diags.push({
                name: '5. Authentication Status',
                status: 'fail',
                message: '❌ Could not check token',
            });
        }

        setResults(diags);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pass':
                return '#00FF88';
            case 'fail':
                return '#FF6B6B';
            case 'warn':
                return '#FFB800';
            case 'loading':
                return '#00B4FF';
            default:
                return '#FFFFFF';
        }
    };

    const getStatusEmoji = (status: string) => {
        switch (status) {
            case 'pass':
                return '✅';
            case 'fail':
                return '❌';
            case 'warn':
                return '⚠️';
            case 'loading':
                return '⏳';
            default:
                return '❓';
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔍 Connection Diagnostic</Text>
                <Text style={styles.subtitle}>Territory Runner Backend Connection Test</Text>
            </View>

            <View style={styles.content}>
                {results.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#00FF88" />
                        <Text style={styles.loadingText}>Running diagnostics...</Text>
                    </View>
                ) : (
                    results.map((result, idx) => (
                        <View key={idx} style={styles.resultCard}>
                            <View style={styles.resultHeader}>
                                <Text style={[styles.resultStatus, { color: getStatusColor(result.status) }]}>
                                    {getStatusEmoji(result.status)}
                                </Text>
                                <Text style={styles.resultName}>{result.name}</Text>
                            </View>
                            <Text style={styles.resultMessage}>{result.message}</Text>
                        </View>
                    ))
                )}

                {/* Troubleshooting Guide */}
                <View style={styles.guideCard}>
                    <Text style={styles.guideTitle}>📋 Troubleshooting</Text>

                    <Text style={styles.guideSectionTitle}>If Backend Unreachable:</Text>
                    <Text style={styles.guideText}>
                        1. Check backend is running: `python -m uvicorn main:app --host 0.0.0.0 --port 8000`{'\n'}
                        2. Check .env has correct IP (no leading zeros in octets){'\n'}
                        3. Check firewall allows port 8000{'\n'}
                        4. Restart Expo after changing .env
                    </Text>

                    <Text style={styles.guideSectionTitle}>If Connected but Login Fails:</Text>
                    <Text style={styles.guideText}>
                        1. Check you have valid account (try signing up){'\n'}
                        2. Ensure email is verified{'\n'}
                        3. Check username/password is correct
                    </Text>

                    <Text style={styles.guideSectionTitle}>If Environment Shows Wrong IP:</Text>
                    <Text style={styles.guideText}>
                        1. Edit frontend/.env{'\n'}
                        2. Get correct IP: `ipconfig | Select-String IPv4`{'\n'}
                        3. Save file{'\n'}
                        4. Ctrl+C to stop Expo{'\n'}
                        5. Run `npm start` again
                    </Text>
                </View>

                {/* Quick Copy Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>ℹ️ Share This Info</Text>
                    <Text style={styles.infoText}>
{`API URL: ${API_BASE_URL}
Platform: ${require('react-native').Platform.OS}
Environment: ${process.env.EXPO_PUBLIC_API_URL ? 'Set' : 'Not Set'}
Timestamp: ${new Date().toISOString()}`}
                    </Text>
                </View>

                {/* Retry Button */}
                <TouchableOpacity style={styles.retryButton} onPress={runDiagnostics}>
                    <Text style={styles.retryButtonText}>🔄 Re-run Diagnostics</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#040810',
    },
    header: {
        backgroundColor: '#0A1020',
        paddingVertical: 24,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 255, 136, 0.1)',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        color: '#8892A4',
        fontSize: 14,
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        height: 200,
    },
    loadingText: {
        color: '#8892A4',
        marginTop: 12,
    },
    resultCard: {
        backgroundColor: '#0A1020',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#00FF88',
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    resultStatus: {
        fontSize: 20,
        marginRight: 10,
    },
    resultName: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
        flex: 1,
    },
    resultMessage: {
        color: '#8892A4',
        fontSize: 12,
        marginLeft: 30,
    },
    guideCard: {
        backgroundColor: '#0A1020',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#00B4FF',
    },
    guideTitle: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 10,
    },
    guideSectionTitle: {
        color: '#00FF88',
        fontWeight: '600',
        fontSize: 12,
        marginTop: 10,
        marginBottom: 4,
    },
    guideText: {
        color: '#8892A4',
        fontSize: 11,
        lineHeight: 16,
    },
    infoCard: {
        backgroundColor: '#0A1020',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#FFB800',
    },
    infoTitle: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 8,
    },
    infoText: {
        color: '#00B4FF',
        fontSize: 11,
        fontFamily: 'monospace',
        lineHeight: 16,
    },
    retryButton: {
        backgroundColor: '#00FF88',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    retryButtonText: {
        color: '#040810',
        fontWeight: '700',
        fontSize: 14,
    },
});
