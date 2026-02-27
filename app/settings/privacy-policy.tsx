import { File02Icon, Shield02Icon } from '@hugeicons/core-free-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { ModernSettingsItem } from '../../components/SettingsComponents';
import { useAppTheme } from '../../constants/theme';

export default function LegalSelectionScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Legal & Privacy" />
            
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                
                <View style={styles.headerArea}>
                    <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                        Please select a document below to review our commitments to your data privacy and our guidelines for using the DART platform.
                    </Text>
                </View>

                {/* Settings-Style Layout */}
                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    
                    {/* Privacy Policy */}
                    <ModernSettingsItem 
                        icon={Shield02Icon} 
                        label="Privacy Policy" 
                        subLabel="How we handle and protect your data"
                        onPress={() => router.push('/settings/docs/privacy-details')} 
                        theme={theme} 
                    />
                    
                    {/* Terms of Service */}
                    <ModernSettingsItem 
                        icon={File02Icon} 
                        label="Terms of Service" 
                        subLabel="Rules and guidelines for using DART"
                        onPress={() => router.push('/settings/docs/terms-of-service')} 
                        theme={theme} 
                        isLast // Ensures no bottom border on the last item
                    />

                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        padding: 24,
        paddingBottom: 60
    },
    headerArea: {
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    description: {
        fontSize: 15,
        fontFamily: 'Nunito_500Medium',
        lineHeight: 24,
        opacity: 0.9,
    },
    card: { 
        borderRadius: 24, 
        borderWidth: 1, 
        padding: 16,
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.05, 
        shadowRadius: 8, 
        elevation: 2 
    },
});