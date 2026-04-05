import React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const { width, height } = Dimensions.get('window');

const FEATURES = [
    { icon: '🎯', label: 'Real-time GPS Tracking', color: '#00FF88' },
    { icon: '🗺️', label: 'Territory Control Map', color: '#00B4FF' },
    { icon: '⚡', label: 'Live Leaderboards', color: '#FF6B6B' },
    { icon: '🏆', label: 'Rank & Progression', color: '#FFD700' },
];

function FeatureRow({ icon, label, color }: { icon: string; label: string; color: string }) {
    return (
        <View style={styles.featureRow}>
            <View style={[styles.featureIconWrap, { borderColor: color + '55', backgroundColor: color + '18' }]}>
                <Text style={styles.featureIcon}>{icon}</Text>
            </View>
            <Text style={styles.featureLabel}>{label}</Text>
            <View style={[styles.featureDot, { backgroundColor: color }]} />
        </View>
    );
}

export default function WelcomeScreen({ navigation }: Props) {

    return (
        <SafeAreaView style={styles.container}>
            {/* Background layers */}
            <View style={styles.orbA} />
            <View style={styles.orbB} />
            <View style={styles.orbC} />
            <View style={styles.grid} />

            <View
                style={styles.content}
            >
                {/* Brand */}
                <View style={styles.brandBlock}>
                    <Text style={styles.kicker}>◆ TACTICAL RUNNING PLATFORM ◆</Text>
                    <Text style={styles.title}>TERRITORY</Text>
                    <Text style={styles.titleAccent}>RUNNER</Text>
                    <View style={styles.titleUnderline} />
                    <Text style={styles.tagline}>
                        Claim streets. Defend zones.{'\n'}Dominate your city with every run.
                    </Text>
                </View>

                {/* Features */}
                <View style={styles.featureCard}>
                    <View style={styles.featureCardHeader}>
                        <View style={styles.featureCardDot} />
                        <Text style={styles.featureCardTitle}>MISSION BRIEFING</Text>
                        <View style={styles.featureCardDot} />
                    </View>
                    {FEATURES.map((f) => (
                        <FeatureRow key={f.label} {...f} />
                    ))}
                </View>

                {/* CTAs */}
                <View style={styles.ctaWrap}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
                        activeOpacity={0.82}
                    >
                        <Text style={styles.primaryButtonText}>▶  LOG IN</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => navigation.navigate('Auth', { screen: 'SignUp' })}
                        activeOpacity={0.82}
                    >
                        <Text style={styles.secondaryButtonText}>+ CREATE ACCOUNT</Text>
                    </TouchableOpacity>

                    <Text style={styles.finePrint}>
                        Join{' '}
                        <Text style={styles.finePrintAccent}>Territory Runner</Text>
                        {' '}and start conquering today.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#040810',
    },
    orbA: {
        position: 'absolute',
        top: -100,
        right: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(0, 255, 136, 0.12)',
    },
    orbB: {
        position: 'absolute',
        bottom: -140,
        left: -90,
        width: 350,
        height: 350,
        borderRadius: 175,
        backgroundColor: 'rgba(0, 180, 255, 0.1)',
    },
    orbC: {
        position: 'absolute',
        top: height * 0.4,
        right: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 60, 100, 0.07)',
    },
    grid: {
        ...StyleSheet.absoluteFillObject,
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: 'rgba(0, 255, 136, 0.07)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 18,
        paddingBottom: 16,
        justifyContent: 'space-between',
    },
    brandBlock: {
        marginTop: 16,
    },
    kicker: {
        fontSize: 10,
        color: '#00FF88',
        letterSpacing: 2,
        fontWeight: '700',
        marginBottom: 16,
        opacity: 0.8,
    },
    title: {
        fontSize: 54,
        lineHeight: 56,
        color: '#F8FAFC',
        fontWeight: '900',
        letterSpacing: 3,
    },
    titleAccent: {
        fontSize: 54,
        lineHeight: 60,
        color: '#00FF88',
        fontWeight: '900',
        letterSpacing: 3,
        textShadowColor: 'rgba(0,255,136,0.45)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 18,
    },
    titleUnderline: {
        marginTop: 10,
        height: 2,
        width: 80,
        backgroundColor: '#00FF88',
        borderRadius: 2,
        shadowColor: '#00FF88',
        shadowOpacity: 0.8,
        shadowRadius: 8,
    },
    tagline: {
        marginTop: 14,
        color: '#94A3B8',
        fontSize: 14,
        lineHeight: 22,
    },
    featureCard: {
        backgroundColor: 'rgba(12, 20, 40, 0.92)',
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.2)',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 16,
        shadowColor: '#00FF88',
        shadowOpacity: 0.08,
        shadowRadius: 16,
    },
    featureCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 8,
    },
    featureCardDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#00FF88',
        flex: 1,
        opacity: 0.6,
    },
    featureCardTitle: {
        color: '#00FF88',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    featureIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureIcon: {
        fontSize: 18,
    },
    featureLabel: {
        flex: 1,
        color: '#CBD5E1',
        fontSize: 13,
        fontWeight: '600',
    },
    featureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    ctaWrap: {
        gap: 10,
    },
    primaryButton: {
        backgroundColor: '#00FF88',
        borderRadius: 14,
        paddingVertical: 17,
        alignItems: 'center',
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 10,
    },
    primaryButtonText: {
        color: '#030F06',
        fontSize: 15,
        letterSpacing: 2,
        fontWeight: '900',
    },
    secondaryButton: {
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#00FF88',
        backgroundColor: 'rgba(0, 255, 136, 0.07)',
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#DBFCE7',
        fontSize: 14,
        letterSpacing: 1.8,
        fontWeight: '800',
    },
    finePrint: {
        textAlign: 'center',
        color: '#475569',
        fontSize: 11,
        marginTop: 4,
    },
    finePrintAccent: {
        color: '#00FF88',
        fontWeight: '700',
    },
});
