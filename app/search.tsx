// filepath: app/search.tsx
import { Cancel01Icon, File02Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getDB } from '../lib/db-client';

// Custom Highlighter Component to highlight searched terms inside strings
const HighlightText = ({ text, highlight, style, highlightStyle, numberOfLines }: any) => {
    if (!text) return null;
    const stringText = String(text);
    
    if (!highlight || !highlight.trim()) {
        return <Text style={style} numberOfLines={numberOfLines}>{stringText}</Text>;
    }

    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = stringText.split(regex);

    return (
        <Text style={style} numberOfLines={numberOfLines}>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <Text key={i} style={highlightStyle}>{part}</Text>
                ) : (
                    <Text key={i}>{part}</Text>
                )
            )}
        </Text>
    );
};

export default function SearchScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { user } = useAuth();
    
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query.trim() || !user) { 
                setResults([]); 
                setLoading(false); 
                return; 
            }
            setLoading(true);
            try {
                const db = await getDB();
                const searchTerm = `%${query.trim()}%`;
                
                // Search across description, remarks, date, and the joined job title (session)
                const data = await db.getAllAsync(`
                    SELECT a.*, j.title as session_title 
                    FROM accomplishments a
                    LEFT JOIN job_positions j ON a.job_id = j.id
                    WHERE a.user_id = ? AND (
                        a.description LIKE ? OR
                        a.remarks LIKE ? OR
                        a.date LIKE ? OR
                        j.title LIKE ?
                    )
                    ORDER BY a.date DESC
                    LIMIT 50
                `, [user.id, searchTerm, searchTerm, searchTerm, searchTerm]);
                
                setResults(data as any[]);
            } catch (e) { 
                console.error("Search err", e); 
            } finally { 
                setLoading(false); 
            }
        }, 400); // 400ms debounce
        
        return () => clearTimeout(timer);
    }, [query, user]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            
            <Header title="Search Entries" onBack={() => router.back()} />

            <View style={[styles.searchWrapper, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <HugeiconsIcon icon={Search01Icon} size={20} color={theme.colors.textSecondary} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search tasks, remarks..."
                        placeholderTextColor={theme.colors.textSecondary}
                        style={[styles.input, { color: theme.colors.text }]}
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.mainContentArea}>
                {/* --- ABSOLUTE CENTERED EMPTY STATES --- */}
                {loading ? (
                    <View style={styles.absoluteCenter} pointerEvents="none">
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                    </View>
                ) : query.length > 0 && results.length === 0 ? (
                    <View style={styles.absoluteCenter} pointerEvents="none">
                        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <HugeiconsIcon icon={Search01Icon} size={36} color={theme.colors.textSecondary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No results found</Text>
                        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                            We couldn&apos;t find anything matching &quot;{query}&quot;
                        </Text>
                    </View>
                ) : query.length === 0 ? (
                    <View style={styles.absoluteCenter} pointerEvents="none">
                        <HugeiconsIcon icon={File02Icon} size={48} color={theme.colors.textSecondary} style={{opacity: 0.3}} />
                        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary, marginTop: 16 }]}>
                            Start typing to search your records.
                        </Text>
                    </View>
                ) : null}

                {/* --- SCROLLABLE RESULTS --- */}
                {query.length > 0 && results.length > 0 && (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {results.map((item) => {
                            const dateFormatted = item.date ? format(parseISO(item.date), 'MMM d, yyyy') : 'Unknown Date';
                            
                            return (
                                <TouchableOpacity 
                                    key={item.id} 
                                    activeOpacity={0.7}
                                    style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    // REFINED: Opens the exact Date Report details
                                    onPress={() => router.push({ pathname: '/reports/details', params: { date: item.date } })}
                                >
                                    <View style={styles.cardHeaderRow}>
                                        <View style={[styles.dateBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <HighlightText 
                                                text={dateFormatted} 
                                                highlight={query} 
                                                style={[styles.dateText, { color: theme.colors.primary }]} 
                                                highlightStyle={{ backgroundColor: theme.colors.primary + '30', color: theme.colors.primary }}
                                            />
                                        </View>
                                        
                                        {/* Shows the Job Session it belonged to */}
                                        {item.session_title && (
                                            <HighlightText 
                                                text={item.session_title} 
                                                highlight={query} 
                                                style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: theme.colors.textSecondary, textTransform: 'uppercase' }} 
                                                highlightStyle={{ color: theme.colors.primary, backgroundColor: theme.colors.primary + '20' }}
                                            />
                                        )}
                                    </View>
                                    
                                    <HighlightText 
                                        text={item.description} 
                                        highlight={query} 
                                        style={[styles.description, { color: theme.colors.text }]} 
                                        highlightStyle={{ backgroundColor: theme.colors.primary + '40', color: theme.colors.primary, fontFamily: 'Nunito_800ExtraBold' }}
                                    />
                                    
                                    {item.remarks && (
                                        <View style={{ marginTop: 8 }}>
                                            <HighlightText 
                                                text={`Note: ${item.remarks}`} 
                                                highlight={query} 
                                                numberOfLines={2}
                                                style={[styles.remarks, { color: theme.colors.textSecondary }]} 
                                                highlightStyle={{ backgroundColor: theme.colors.primary + '30', color: theme.colors.primary, fontFamily: 'Nunito_700Bold' }}
                                            />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchWrapper: { paddingHorizontal: 20, paddingVertical: 12, zIndex: 10 },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        borderRadius: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        gap: 12,
    },
    input: { flex: 1, fontSize: 16, fontFamily: 'Nunito_500Medium' },
    
    mainContentArea: {
        flex: 1,
        position: 'relative'
    },
    
    // Absolute Center specifically ignores the space taken by the search bar above it
    absoluteCenter: { 
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingHorizontal: 40,
        marginTop: -60, // Slight upward shift to visibly center it perfectly 
        zIndex: -1 
    },

    scrollContent: { padding: 20, paddingBottom: 100, flexGrow: 1 },
    
    card: { 
        padding: 16, 
        borderRadius: 20, 
        borderWidth: 1, 
        marginBottom: 12,
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.03, 
        shadowRadius: 8, 
        elevation: 2 
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    dateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    dateText: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
    description: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', lineHeight: 22 },
    remarks: { fontSize: 13, fontFamily: 'Nunito_500Medium', fontStyle: 'italic', lineHeight: 18 },

    emptyIconContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22 },
});