import {
    Cancel01Icon,
    PlusSignIcon,
    Search01Icon,
    Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
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
    const [showModal, setShowModal] = useState(visible);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(MODAL_HEIGHT);

    // FIX: Eliminated useEffect dependencies warning by utilizing useMemo
    const filteredOptions = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        let results = options.filter(opt => opt.label.toLowerCase().includes(lowerSearch));
        
        // Only prioritize selected item if the user is not actively searching
        if (currentValue && search.length === 0) {
            results = results.sort((a, b) => {
                const isA = a.value === currentValue || a.label === currentValue;
                const isB = b.value === currentValue || b.label === currentValue;
                if (isA && !isB) return -1;
                if (!isA && isB) return 1;
                return 0;
            });
        }
        return results;
    }, [options, search, currentValue]);

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            setSearch('');
            // REFINED: Smooth timing animations rather than bouncy spring
            opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
            translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
        } else {
            opacity.value = withTiming(0, { duration: 200 });
            translateY.value = withTiming(MODAL_HEIGHT, { duration: 250, easing: Easing.in(Easing.cubic) }, (finished) => {
                if (finished) runOnJS(setShowModal)(false);
            });
        }
    }, [visible]);

    const handleClose = () => onClose();

    const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value, backgroundColor: 'rgba(0,0,0,0.5)' }));
    const animatedContainerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    if (!showModal) return null;

    return (
        <Modal transparent visible={showModal} onRequestClose={handleClose} animationType="none">
            {/* REFINED: Removed KeyboardAvoidingView to stop layout jumping when search is active */}
            <View style={styles.overlayContainer}>
                <AnimatedPressable style={[StyleSheet.absoluteFill, animatedBackdropStyle]} onPress={handleClose} />
                <Animated.View style={[styles.modalContainer, { backgroundColor: theme.colors.card, height: MODAL_HEIGHT }, animatedContainerStyle]}>
                    
                    <ModalHeader title={title} position="center" />

                    <View style={[styles.searchContainer, { borderBottomColor: theme.colors.border }]}>
                        <View style={[styles.searchInputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1 }]}>
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
                        keyExtractor={(item, index) => item.value + index.toString()}
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: 250 }} // Added large padding bottom so it acts seamlessly with keyboards
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No matching options found</Text>
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => { onSelect(search); handleClose(); }} style={[styles.addButton, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <HugeiconsIcon icon={PlusSignIcon} size={18} color={theme.colors.primary} />
                                        {/* FIX: Escaped Quotation Marks */}
                                        <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Use &quot;{search}&quot;</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        }
                        renderItem={({ item }) => {
                            const isSelected = currentValue === item.value || currentValue === item.label;
                            return (
                                <TouchableOpacity 
                                    onPress={() => { onSelect(item.value); handleClose(); }} 
                                    style={[styles.optionItem, { 
                                        borderBottomColor: theme.colors.border, 
                                        backgroundColor: isSelected ? theme.colors.primary + '0A' : 'transparent' 
                                    }]} 
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.optionText, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '500' }]}>{item.label}</Text>
                                    {/* FIX: Removed invalid weight prop */}
                                    {isSelected && <HugeiconsIcon icon={Tick02Icon} size={22} color={theme.colors.primary} />}
                                </TouchableOpacity>
                            );
                        }}
                    />
                    <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                        <Button title="Cancel" variant="neutral" onPress={handleClose} />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlayContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    modalContainer: { width: '100%', maxWidth: 400, borderRadius: 28, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 15 },
    searchContainer: { padding: 16, borderBottomWidth: 1 },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 50, borderRadius: 16 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'Nunito_600SemiBold', height: '100%' },
    optionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1 },
    optionText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },
    emptyContainer: { alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 15, fontFamily: 'Nunito_400Regular', marginBottom: 20 },
    addButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100 },
    addButtonText: { marginLeft: 8, fontSize: 15, fontFamily: 'Nunito_700Bold' },
    footer: { padding: 16, borderTopWidth: 1 },
});