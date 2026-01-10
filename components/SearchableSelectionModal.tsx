import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '../constants/theme';

export default function SearchableSelectionModal({ 
    visible, 
    onClose, 
    title, 
    options = [], // Default to empty array if undefined
    onSelect, 
    placeholder, 
    theme, 
    currentValue 
}: any) {
    const defaultTheme = useAppTheme();
    const activeTheme = theme || defaultTheme; 
    
    const [search, setSearch] = useState('');

    // --- FIX: Added safety check (opt || '') to prevent crash ---
    const filteredOptions = options.filter((opt: string) => {
        if (!opt) return false; // Skip null/undefined items
        return String(opt).toLowerCase().includes(search.toLowerCase());
    });

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={[styles.modalContainer, { backgroundColor: activeTheme.colors.card, borderColor: activeTheme.colors.border }]}>
                    <View style={[styles.header, { borderBottomColor: activeTheme.colors.border }]}>
                        <Text style={[styles.title, { color: activeTheme.colors.text }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <HugeiconsIcon icon={Cancel01Icon} size={24} color={activeTheme.colors.icon} />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={[styles.searchContainer, { backgroundColor: activeTheme.colors.background, borderColor: activeTheme.colors.border }]}>
                        <HugeiconsIcon icon={Search01Icon} size={20} color={activeTheme.colors.icon} />
                        <TextInput 
                            value={search}
                            onChangeText={setSearch}
                            placeholder={placeholder}
                            placeholderTextColor={activeTheme.colors.textSecondary}
                            style={[styles.input, { color: activeTheme.colors.text }]}
                        />
                    </View>

                    <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 16 }}>
                        {filteredOptions.map((option: string, index: number) => (
                            <TouchableOpacity 
                                key={index} 
                                onPress={() => { onSelect(option); onClose(); setSearch(''); }}
                                style={[
                                    styles.option, 
                                    { borderBottomColor: activeTheme.colors.border },
                                    currentValue === option && { backgroundColor: activeTheme.colors.primaryLight }
                                ]}
                            >
                                <Text style={[
                                    styles.optionText, 
                                    { color: currentValue === option ? activeTheme.colors.primary : activeTheme.colors.text }
                                ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        
                        {filteredOptions.length === 0 && (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: activeTheme.colors.textSecondary }}>No results found.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    modalContainer: { borderRadius: 24, maxHeight: '70%', borderWidth: 1, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    title: { fontSize: 18, fontWeight: '700' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, height: 44 },
    input: { flex: 1, marginLeft: 8, fontSize: 16, fontWeight: '600' },
    list: { paddingHorizontal: 16 },
    option: { paddingVertical: 16, borderBottomWidth: 1, borderRadius: 8, paddingHorizontal: 8 },
    optionText: { fontSize: 16, fontWeight: '600' }
});