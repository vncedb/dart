import {
    Cancel01Icon,
    PlusSignIcon,
    Search01Icon,
    Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import ModalHeader from './ModalHeader';

interface Option { label: string; value: string; }

interface SearchableSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (value: string) => void;
    title: string;
    options: Option[];
    placeholder?: string;
    currentValue?: any;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const MODAL_HEIGHT = 550;

export default function SearchableSelectionModal({
    visible,
    onClose,
    onSelect,
    title,
    options,
    placeholder,
    currentValue
}: SearchableSelectionModalProps) {
    const theme = useAppTheme();
    const [search, setSearch] = useState('');
    const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);
    const [showModal, setShowModal] = useState(visible);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(MODAL_HEIGHT);

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            setSearch('');
            sortAndFilterOptions('', options);
            opacity.value = withTiming(1, { duration: 200 });
            translateY.value = withSpring(0, { damping: 15, mass: 0.8, stiffness: 100 });
        } else {
            opacity.value = withTiming(0, { duration: 150 });
            translateY.value = withTiming(MODAL_HEIGHT, { duration: 200 }, (finished) => {
                if (finished) runOnJS(setShowModal)(false);
            });
        }
    }, [visible, options]);

    useEffect(() => { sortAndFilterOptions(search, options); }, [search, options, currentValue]);

    const sortAndFilterOptions = (searchText: string, allOptions: Option[]) => {
        const lowerSearch = searchText.toLowerCase();
        let results = allOptions.filter(opt => opt.label.toLowerCase().includes(lowerSearch));
        if (currentValue) {
            results = results.sort((a, b) => {
                const isA = a.value === currentValue || a.label === currentValue;
                const isB = b.value === currentValue || b.label === currentValue;
                if (isA && !isB) return -1;
                if (!isA && isB) return 1;
                return 0;
            });
        }
        setFilteredOptions(results);
    };

    const handleClose = () => onClose();

    const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value, backgroundColor: 'rgba(0,0,0,0.5)' }));
    const animatedContainerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    if (!showModal) return null;

    return (
        <Modal transparent visible={showModal} onRequestClose={handleClose} animationType="none">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={styles.overlayContainer}>
                    <AnimatedPressable style={[StyleSheet.absoluteFill, animatedBackdropStyle]} onPress={handleClose} />
                    <Animated.View style={[styles.modalContainer, { backgroundColor: theme.colors.card, height: MODAL_HEIGHT }, animatedContainerStyle]}>
                        
                        <ModalHeader title={title} position="center" />

                        <View style={[styles.searchContainer, { borderBottomColor: theme.colors.border }]}>
                            <View style={[styles.searchInputWrapper, { backgroundColor: theme.colors.background }]}>
                                <HugeiconsIcon icon={Search01Icon} size={20} color={theme.colors.textSecondary} />
                                <TextInput
                                    placeholder={placeholder || "Search..."}
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={search}
                                    onChangeText={setSearch}
                                    style={[styles.searchInput, { color: theme.colors.text }]}
                                    autoCorrect={false}
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
                                        <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <FlatList
                            data={filteredOptions}
                            keyExtractor={(item, index) => item.value + index}
                            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No matching options found</Text>
                                    {search.length > 0 && (
                                        <TouchableOpacity onPress={() => { onSelect(search); handleClose(); }} style={[styles.addButton, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <HugeiconsIcon icon={PlusSignIcon} size={18} color={theme.colors.primary} />
                                            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Use "{search}"</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            }
                            renderItem={({ item }) => {
                                const isSelected = currentValue === item.value || currentValue === item.label;
                                return (
                                    <TouchableOpacity onPress={() => { onSelect(item.value); handleClose(); }} style={[styles.optionItem, { borderBottomColor: theme.colors.border, backgroundColor: isSelected ? theme.colors.primary + '08' : 'transparent' }]} activeOpacity={0.7}>
                                        <Text style={[styles.optionText, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '500' }]}>{item.label}</Text>
                                        {isSelected && <HugeiconsIcon icon={Tick02Icon} size={22} color={theme.colors.primary} weight="fill" />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                            <Button title="Cancel" variant="neutral" onPress={handleClose} />
                        </View>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlayContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    modalContainer: { width: '100%', maxWidth: 400, borderRadius: 24, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    searchContainer: { padding: 16, borderBottomWidth: 1 },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, borderRadius: 14 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '500', height: '100%' },
    optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
    optionText: { fontSize: 16 },
    emptyContainer: { alignItems: 'center', padding: 32 },
    emptyText: { fontSize: 15, marginBottom: 16 },
    addButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 100 },
    addButtonText: { marginLeft: 8, fontSize: 15, fontWeight: '700' },
    footer: { padding: 16, borderTopWidth: 1 },
});