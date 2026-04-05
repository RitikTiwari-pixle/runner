/**
 * RunControls — Start / Pause / Resume / Stop buttons.
 * Uses animated press feedback and color-coded states.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RunStatus } from '../types/run';

interface Props {
    status: RunStatus;
    onStart: () => Promise<void> | void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => Promise<void> | void;
}

export default function RunControls({ status, onStart, onPause, onResume, onStop }: Props) {
    const handleStop = () => {
        Alert.alert(
            'End Run?',
            'Are you sure you want to finish this run?',
            [
                { text: 'Keep Running', style: 'cancel' },
                { text: 'End Run', style: 'destructive', onPress: onStop },
            ]
        );
    };

    if (status === 'idle' || status === 'finished') {
        return (
            <View style={styles.container}>
                <TouchableOpacity
                    style={[styles.button, styles.startButton]}
                    onPress={onStart}
                    activeOpacity={0.8}
                >
                    <Text style={styles.startText}>▶  START RUN</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {status === 'running' ? (
                <TouchableOpacity
                    style={[styles.button, styles.pauseButton]}
                    onPress={onPause}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>⏸  PAUSE</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={[styles.button, styles.resumeButton]}
                    onPress={onResume}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>▶  RESUME</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[styles.button, styles.stopButton]}
                onPress={handleStop}
                activeOpacity={0.8}
            >
                <Text style={styles.stopText}>⏹  STOP</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButton: {
        backgroundColor: '#00FF88',
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    pauseButton: {
        backgroundColor: 'rgba(255, 186, 0, 0.15)',
        borderWidth: 1.5,
        borderColor: '#FFBA00',
    },
    resumeButton: {
        backgroundColor: 'rgba(0, 255, 136, 0.15)',
        borderWidth: 1.5,
        borderColor: '#00FF88',
    },
    stopButton: {
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
        borderWidth: 1.5,
        borderColor: '#FF3B30',
    },
    startText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0A0A0A',
        letterSpacing: 2,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 1.5,
    },
    stopText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FF3B30',
        letterSpacing: 1.5,
    },
});
