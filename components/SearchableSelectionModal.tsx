import {
    Cancel01Icon,
    PlusSignIcon,
    Search01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface Option {
    label: string;
    value: string;
}

interface SearchableSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (value: string) => void;
    title: string;
    options: Option[];
    placeholder?: string;
    // Added optional props to maintain compatibility with your existing parent components
    theme?: any; 
    currentValue?: any;
}

export default function SearchableSelectionModal({ 
    visible, 
    onClose, 
    onSelect, 
    title, 
    options, 
    placeholder 
}: SearchableSelectionModalProps) {
    const [search, setSearch] = useState('');
    const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);

    // Reset search when modal opens
    useEffect(() => {
        if (visible) {
            setSearch('');
            setFilteredOptions(options);
        }
    }, [visible, options]);

    // Local Filtering Logic
    useEffect(() => {
        const lowerSearch = search.toLowerCase();
        const results = options.filter(opt => 
            opt.label.toLowerCase().includes(lowerSearch)
        );
        setFilteredOptions(results);
    }, [search, options]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable 
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} 
                onPress={onClose}
            >
                <Pressable className="overflow-hidden bg-white shadow-xl dark:bg-slate-800 rounded-3xl" onPress={() => {}}>
                    {/* Header */}
                    <View className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <Text className="font-bold text-center text-slate-900 dark:text-white">{title}</Text>
                    </View>
                    
                    {/* Search Bar */}
                    <View className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                        <View className="flex-row items-center px-4 py-3 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                            <HugeiconsIcon icon={Search01Icon} size={20} color="#94a3b8" />
                            <TextInput 
                                placeholder={placeholder || "Search..."}
                                placeholderTextColor="#94a3b8"
                                value={search}
                                onChangeText={setSearch}
                                className="flex-1 ml-3 text-base font-medium text-slate-900 dark:text-white"
                                autoFocus={false}
                            />
                            {/* Clear Button */}
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <HugeiconsIcon icon={Cancel01Icon} size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* List with Fixed Max Height */}
                    <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => (
                                <TouchableOpacity 
                                    key={idx} 
                                    onPress={() => { onSelect(opt.value); onClose(); }} 
                                    className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700"
                                >
                                    <Text className="text-base font-medium text-slate-700 dark:text-white">{opt.label}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View className="items-center p-8">
                                <Text className="text-slate-400">No matching options found</Text>
                            </View>
                        )}
                        
                        {/* Add Custom Option Logic */}
                        {search.length > 0 && !filteredOptions.find(o => o.label.toLowerCase() === search.toLowerCase()) && (
                            <TouchableOpacity 
                                onPress={() => { onSelect(search); onClose(); }} 
                                className="flex-row items-center px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20"
                            >
                                <HugeiconsIcon icon={PlusSignIcon} size={20} color="#6366f1" />
                                <Text className="ml-3 font-bold text-indigo-600 dark:text-indigo-400">Add &quot;{search}&quot;</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <TouchableOpacity onPress={onClose} className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700">
                        <Text className="font-bold text-center text-red-500">Cancel</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}