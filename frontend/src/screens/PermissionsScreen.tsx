/**
 * PermissionsScreen — Onboarding gate that requests Location & Notifications
 * before letting the user into the main app.
 *
 * Location (foreground) is REQUIRED to continue.
 * Notifications are recommended but optional.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Animated,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    checkAllPermissions,
    requestLocationPermissions,
    requestNotificationPermissions,
    PermissionStatus,
} from '../utils/permissions';

interface PermissionsScreenProps {
    onPermissionsGranted: () => void;
}

type CardStatus = 'pending' | 'granted' | 'denied';

export default function PermissionsScreen({ onPermissionsGranted }: PermissionsScreenProps) {
    const [locationStatus, setLocationStatus] = useState<CardStatus>('pending');
    const [notifStatus, setNotifStatus] = useState<CardStatus>('pending');
    const [loading, setLoading] = useState<'location' | 'notif' | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0));
    const slideAnim = useRef(new Animated.Value(40));
    const pulseAnim = useRef(new Animated.Value(1));

    const refreshStatus = async () => {
        const perms: PermissionStatus = await checkAllPermissions();
        setLocationStatus(perms.locationForeground ? 'granted' : 'pending');
        setNotifStatus(perms.notifications ? 'granted' : 'pending');
    };

    useEffect(() => {
        // Entry animation
        Animated.parallel([
            Animated.timing(fadeAnim.current, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim.current, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse animation for the continue button
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim.current, {
                    toValue: 1.04,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim.current, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Check current status on mount
        refreshStatus();
    }, [fadeAnim, slideAnim, pulseAnim]);

    const handleGrantLocation = async () => {
        setLoading('location');
        try {
            const granted = await requestLocationPermissions();
            setLocationStatus(granted ? 'granted' : 'denied');
        } catch {
            setLocationStatus('denied');
        }
        setLoading(null);
    };

    const handleGrantNotifications = async () => {
        setLoading('notif');
        try {
            const granted = await requestNotificationPermissions();
            setNotifStatus(granted ? 'granted' : 'denied');
        } catch {
            setNotifStatus('denied');
        }
        setLoading(null);
    };

    const canContinue = locationStatus === 'granted';

    const handleContinue = () => {
        if (canContinue) {
            onPermissionsGranted();
        }
    };

    const getStatusIcon = (status: CardStatus): string => {
        switch (status) {
            case 'granted': return '✅';
            case 'denied': return '⚠️';
            default: return '⏳';
        }
    };

    const getStatusLabel = (status: CardStatus): string => {
        switch (status) {
            case 'granted': return 'GRANTED';
            case 'denied': return 'DENIED';
            default: return 'REQUIRED';
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
            <SafeAreaView style={styles.safe}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerIcon}>🛡️</Text>
                        <Text style={styles.title}>Almost Ready!</Text>
                        <Text style={styles.subtitle}>
                            Territory Runner needs a couple of permissions to track your runs and keep you updated.
                        </Text>
                    </View>

                    {/* Permission Cards */}
                    <View style={styles.cardsWrap}>
                        {/* Location Card */}
                        <View style={[
                            styles.card,
                            locationStatus === 'granted' && styles.cardGranted,
                            locationStatus === 'denied' && styles.cardDenied,
                        ]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardIcon}>📍</Text>
                                <View style={styles.cardInfo}>
                                    <Text style={styles.cardTitle}>Location Access</Text>
                                    <Text style={styles.cardDesc}>
                                        Track your run route and capture territories on the map.
                                    </Text>
                                </View>
                                <Text style={styles.statusIcon}>{getStatusIcon(locationStatus)}</Text>
                            </View>

                            <View style={styles.cardFooter}>
                                <View style={[
                                    styles.statusBadge,
                                    locationStatus === 'granted' && styles.statusBadgeGranted,
                                    locationStatus === 'denied' && styles.statusBadgeDenied,
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        locationStatus === 'granted' && styles.statusTextGranted,
                                        locationStatus === 'denied' && styles.statusTextDenied,
                                    ]}>
                                        {getStatusLabel(locationStatus)}
                                    </Text>
                                </View>

                                {locationStatus !== 'granted' && (
                                    <TouchableOpacity
                                        style={[styles.grantBtn, loading === 'location' && styles.grantBtnDisabled]}
                                        onPress={locationStatus === 'denied' ? () => Linking.openSettings() : handleGrantLocation}
                                        disabled={loading === 'location'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.grantBtnText}>
                                            {loading === 'location'
                                                ? '...'
                                                : locationStatus === 'denied'
                                                    ? 'Open Settings'
                                                    : 'Grant'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Notifications Card */}
                        <View style={[
                            styles.card,
                            notifStatus === 'granted' && styles.cardGranted,
                            notifStatus === 'denied' && styles.cardDenied,
                        ]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardIcon}>🔔</Text>
                                <View style={styles.cardInfo}>
                                    <Text style={styles.cardTitle}>Notifications</Text>
                                    <Text style={styles.cardDesc}>
                                        Get alerted when someone steals your territory!
                                    </Text>
                                </View>
                                <Text style={styles.statusIcon}>{getStatusIcon(notifStatus)}</Text>
                            </View>

                            <View style={styles.cardFooter}>
                                <View style={[
                                    styles.statusBadge,
                                    notifStatus === 'granted' && styles.statusBadgeGranted,
                                    notifStatus === 'denied' && styles.statusBadgeDenied,
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        notifStatus === 'granted' && styles.statusTextGranted,
                                        notifStatus === 'denied' && styles.statusTextDenied,
                                    ]}>
                                        {notifStatus === 'pending' ? 'OPTIONAL' : getStatusLabel(notifStatus)}
                                    </Text>
                                </View>

                                {notifStatus !== 'granted' && (
                                    <TouchableOpacity
                                        style={[styles.grantBtn, styles.grantBtnSecondary, loading === 'notif' && styles.grantBtnDisabled]}
                                        onPress={notifStatus === 'denied' ? () => Linking.openSettings() : handleGrantNotifications}
                                        disabled={loading === 'notif'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.grantBtnText, styles.grantBtnTextSecondary]}>
                                            {loading === 'notif'
                                                ? '...'
                                                : notifStatus === 'denied'
                                                    ? 'Open Settings'
                                                    : 'Enable'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Continue Button */}
                    <View style={styles.bottomWrap}>
                        {!canContinue && (
                            <Text style={styles.hint}>
                                Grant location access to continue
                            </Text>
                        )}
                        <View>
                            <TouchableOpacity
                                style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
                                onPress={handleContinue}
                                disabled={!canContinue}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
                                    {canContinue ? 'LET\'S GO! 🏃' : 'WAITING FOR PERMISSIONS'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
    },
    safe: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'space-between',
    },

    // ─── Header ──────────────────────────────
    header: {
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 12,
    },
    headerIcon: {
        fontSize: 56,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 1,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 15,
        color: '#8B95A5',
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 300,
    },

    // ─── Cards ───────────────────────────────
    cardsWrap: {
        gap: 16,
    },
    card: {
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1F2937',
    },
    cardGranted: {
        borderColor: 'rgba(0, 230, 118, 0.4)',
        backgroundColor: 'rgba(0, 230, 118, 0.05)',
    },
    cardDenied: {
        borderColor: 'rgba(255, 107, 107, 0.4)',
        backgroundColor: 'rgba(255, 107, 107, 0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    cardIcon: {
        fontSize: 32,
        marginRight: 14,
        marginTop: 2,
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 13,
        color: '#8B95A5',
        lineHeight: 18,
    },
    statusIcon: {
        fontSize: 20,
        marginLeft: 8,
        marginTop: 2,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    // ─── Status Badges ───────────────────────
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(139, 149, 165, 0.15)',
    },
    statusBadgeGranted: {
        backgroundColor: 'rgba(0, 230, 118, 0.15)',
    },
    statusBadgeDenied: {
        backgroundColor: 'rgba(255, 107, 107, 0.15)',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8B95A5',
        letterSpacing: 1,
    },
    statusTextGranted: {
        color: '#00E676',
    },
    statusTextDenied: {
        color: '#FF6B6B',
    },

    // ─── Grant Buttons ───────────────────────
    grantBtn: {
        backgroundColor: '#00E676',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    grantBtnSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#00E676',
    },
    grantBtnDisabled: {
        opacity: 0.5,
    },
    grantBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0A0E1A',
        letterSpacing: 0.5,
    },
    grantBtnTextSecondary: {
        color: '#00E676',
    },

    // ─── Bottom / Continue ───────────────────
    bottomWrap: {
        paddingBottom: 24,
        alignItems: 'center',
        gap: 12,
    },
    hint: {
        fontSize: 13,
        color: '#6B7280',
        letterSpacing: 0.3,
    },
    continueBtn: {
        backgroundColor: '#00E676',
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 14,
        minWidth: 280,
        alignItems: 'center',
    },
    continueBtnDisabled: {
        backgroundColor: '#1F2937',
    },
    continueBtnText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0A0E1A',
        letterSpacing: 2,
    },
    continueBtnTextDisabled: {
        color: '#4B5563',
    },
});
