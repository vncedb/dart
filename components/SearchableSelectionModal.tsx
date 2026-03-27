import {
    Cancel01Icon,
    PlusSignIcon,
    Search01Icon,
    Tick01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Keyboard,
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
    Easing,
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.86), 720);
const HIDDEN_TRANSLATE_Y = SHEET_HEIGHT;

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
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);

    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(visible);
    const translateY = useSharedValue(HIDDEN_TRANSLATE_Y);

    const filteredOptions = useMemo(() => {
        const lowerSearch = search.trim().toLowerCase();
        const noneOptions: Option[] = [];
        const regularOptions: Option[] = [];

        options.forEach((option) => {
            if (!option.label.toLowerCase().includes(lowerSearch)) return;

            if (option.label.trim().toLowerCase() === 'none') {
                noneOptions.push(option);
            } else {
                regularOptions.push(option);
            }
        });

        regularOptions.sort((a, b) => a.label.localeCompare(b.label));
        return [...noneOptions, ...regularOptions];
    }, [options, search]);

    const close = () => {
        Keyboard.dismiss();
        translateY.value = withTiming(HIDDEN_TRANSLATE_Y, { duration: 220, easing: Easing.in(Easing.cubic) });
        if (showModal) {
            setTimeout(() => {
                setShowModal(false);
                onClose();
            }, 220);
        }
    };

    useEffect(() => {
        if (!visible) {
            if (showModal) {
                close();
            }
            return;
        }

        setShowModal(true);
        setSearch('');
        translateY.value = HIDDEN_TRANSLATE_Y;
        translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });

        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 180);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!showModal) return null;

    return (
        <Modal transparent visible={showModal} onRequestClose={close} animationType="none" statusBarTranslucent>
            <View style={styles.overlayContainer}>
                <Animated.View
                    entering={FadeIn.duration(260)}
                    exiting={FadeOut.duration(220)}
                    style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardLayer}
                    pointerEvents="box-none"
                >
                    <Animated.View
                        style={[
                            styles.modalContainer,
                            {
                                backgroundColor: theme.colors.card,
                                height: SHEET_HEIGHT,
                                paddingBottom: Math.max(insets.bottom, 18),
                            },
                            animatedContainerStyle,
                        ]}
                    >
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                        </View>

                        <ModalHeader
                            title={title}
                            subtitle={`${filteredOptions.length} ${filteredOptions.length === 1 ? 'option' : 'options'}`}
                            position="bottom"
                            onClose={close}
                        />

                        <View style={[styles.searchSection, { borderBottomColor: theme.colors.border }]}> 
                            <View
                                style={[
                                    styles.searchInputWrapper,
                                    {
                                        backgroundColor: theme.colors.card,
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                            >
                                <HugeiconsIcon icon={Search01Icon} size={18} color={theme.colors.textSecondary} />
                                <TextInput
                                    ref={inputRef}
                                    placeholder={placeholder || 'Search...'}
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={search}
                                    onChangeText={setSearch}
                                    style={[styles.searchInput, { color: theme.colors.text }]}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    returnKeyType="search"
                                    selectionColor={theme.colors.primary}
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setSearch('')}
                                        hitSlop={10}
                                        style={[styles.clearButton, { backgroundColor: theme.colors.background }]}
                                    >
                                        <HugeiconsIcon icon={Cancel01Icon} size={16} color={theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                        </View>

                        <FlatList
                            data={filteredOptions}
                            keyExtractor={(item, index) => `${item.value}-${index}`}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                            removeClippedSubviews={Platform.OS === 'android'}
                            initialNumToRender={14}
                            maxToRenderPerBatch={18}
                            windowSize={10}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No matching options</Text>
                                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Try a different keyword or use your current search.</Text>
                                    {search.trim().length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => { onSelect(search.trim()); close(); }}
                                            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
                                            activeOpacity={0.85}
                                        >
                                            <HugeiconsIcon icon={PlusSignIcon} size={18} color="#fff" />
                                            <Text style={styles.addButtonText}>Use &quot;{search.trim()}&quot;</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            }
                            renderItem={({ item }) => {
                                const isSelected = currentValue === item.value || currentValue === item.label;

                                return (
                                    <TouchableOpacity
                                        onPress={() => { onSelect(item.value); close(); }}
                                        style={[
                                            styles.optionItem,
                                            {
                                                backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.card,
                                                borderColor: isSelected ? theme.colors.primary + '28' : theme.colors.border,
                                            },
                                        ]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.optionText, { color: isSelected ? theme.colors.primary : theme.colors.text }]}>
                                            {item.label}
                                        </Text>

                                        <View
                                            style={[
                                                styles.optionIndicator,
                                                {
                                                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
                                                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                                },
                                            ]}
                                        >
                                            {isSelected ? <HugeiconsIcon icon={Tick01Icon} size={18} color="#fff" /> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}> 
                            <Button title="Cancel" variant="neutral" onPress={close} style={{ width: '100%' }} />
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    keyboardLayer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        width: '100%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
        elevation: 24,
        position: 'absolute',
        bottom: 0,
    },
    handleContainer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
    searchSection: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        gap: 12,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        fontFamily: 'Nunito_600SemiBold',
        minHeight: 48,
    },
    clearButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 24,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 18,
        borderWidth: 1,
        gap: 12,
    },
    optionText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: -0.2,
    },
    optionIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: 'Nunito_800ExtraBold',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Nunito_500Medium',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 999,
        gap: 8,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Nunito_800ExtraBold',
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 14,
        borderTopWidth: 1,
    },
});
