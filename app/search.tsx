// filepath: app/search.tsx
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { searchAccomplishments } from '../lib/database';

export default function SearchScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { user } = useAuth();
    
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query.trim() || !user) { setResults([]); return; }
            setLoading(true);
            try {
                const data = await searchAccomplishments(user.id, query);
                setResults(data);
            } catch (e) { console.error("Search err", e); }
            finally { setLoading(false); }
        }, 300); // debounce
        return () => clearTimeout(timer);
    }, [query, user]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <TextInput 
                    style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                    placeholder="Search accomplishments..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                />
            </View>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                {loading && <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />}
                {!loading && query && results.length === 0 && (
                    <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, marginTop: 40 }}>No results found.</Text>
                )}
                {!loading && results.map(item => (
                    <TouchableOpacity 
                        key={item.id} 
                        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                        onPress={() => router.push({ pathname: '/reports/add-entry', params: { id: item.id } })}
                    >
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                            {format(new Date(item.date), 'MMMM d, yyyy')}
                        </Text>
                        <Text style={{ color: theme.colors.text, fontSize: 16, fontFamily: 'Nunito_600SemiBold' }}>
                            {item.description}
                        </Text>
                        {item.remarks && (
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 }}>{item.remarks}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    backBtn: { padding: 8, marginRight: 8 },
    input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, borderWidth: 1, fontSize: 16, fontFamily: 'Nunito_500Medium' },
    card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 }
});