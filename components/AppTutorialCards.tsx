import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

export default function AppTutorialCards() {
    const theme = useAppTheme();

    const tutorials = [
        {
            id: '1',
            title: "Track Your Time",
            description: "Easily clock in and out, track your breaks, and manage your daily attendance seamlessly.",
            // CHANGED: Fixed path to go up only one level
            image: require('../assets/stickers/time-tracking.png') 
        },
        {
            id: '2',
            title: "Generate Reports",
            description: "Export detailed attendance and task reports in PDF or CSV formats instantly.",
            // CHANGED: Fixed path to go up only one level
            image: require('../assets/stickers/reports.png')
        },
        {
            id: '3',
            title: "Secure & Offline",
            description: "Your data stays safe on your device and syncs automatically when you're back online.",
            // CHANGED: Fixed path to go up only one level
            image: require('../assets/stickers/security.png')
        }
    ];

    return (
        <View style={styles.container}>
            <Text style={[styles.headerText, { color: theme.colors.text }]}>What you can do with DART</Text>
            
            {tutorials.map((item, index) => (
                <Animated.View 
                    key={item.id} 
                    entering={FadeInDown.delay(400 + (index * 150)).duration(500)}
                    style={[
                        styles.card, 
                        { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                    ]}
                >
                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
                        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{item.description}</Text>
                    </View>
                    <View style={[styles.imageContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                        <Image source={item.image} style={styles.image} resizeMode="contain" />
                    </View>
                </Animated.View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        marginBottom: 24,
    },
    headerText: {
        fontSize: 18,
        fontFamily: 'Nunito_800ExtraBold',
        marginBottom: 16,
        marginLeft: 8,
        letterSpacing: -0.3,
    },
    card: {
        flexDirection: 'row',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 16,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    textContainer: {
        flex: 1,
        paddingRight: 20,
    },
    title: {
        fontSize: 17,
        fontFamily: 'Nunito_800ExtraBold',
        marginBottom: 6,
        letterSpacing: -0.2,
    },
    description: {
        fontSize: 14,
        fontFamily: 'Nunito_500Medium',
        lineHeight: 22,
        opacity: 0.9,
    },
    imageContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    image: {
        width: '100%',
        height: '100%',
    }
});