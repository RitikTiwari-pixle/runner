import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function SplashScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.ringOuter}>
                <View style={styles.ringInner}>
                    <Text style={styles.title}>TERRITORY RUNNER</Text>
                    <Text style={styles.subtitle}>Preparing your mission...</Text>
                </View>
            </View>
            <ActivityIndicator size="large" color="#00FF88" style={styles.loader} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050914',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    ringOuter: {
        width: 260,
        height: 260,
        borderRadius: 130,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(4, 12, 24, 0.7)',
    },
    ringInner: {
        width: 210,
        height: 210,
        borderRadius: 105,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        color: '#F8FAFC',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 1.2,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 10,
        color: '#9CA3AF',
        fontSize: 13,
        letterSpacing: 0.4,
        textAlign: 'center',
    },
    loader: {
        marginTop: 28,
    },
});
