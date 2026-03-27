// filepath: components/SelectDropdown.tsx
import { ArrowDown01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Keyboard,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useAppTheme } from '../constants/theme';
import Button from './Button';

interface Option {
    label: string;
    value: any;
    icon?: React.ReactNode;
    description?: string;
}

interface SelectDropdownProps {
    label?: string;
    value: any;
    options: Option[];
    onChange: (value: any) => void;
    placeholder?: string;
    multiple?: boolean;
    customTrigger?: React.ReactNode;
}

export default function SelectDropdown({ label, value, options, onChange, placeholder = 'Select', multiple = false, customTrigger }: SelectDropdownProps) {
    const theme = useAppTheme();
    const [visible, setVisible] = useState(false);
    const sheetTranslateY = useRef(new Animated.Value(0)).current;
    const isClosingRef = useRef(false);

    const selectedOption = options.find((option) => option.value === value);

    const settleSheet = () => {
        Animated.spring(sheetTranslateY, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            mass: 0.85,
            useNativeDriver: true,
        }).start();
    };

    const closeDropdown = () => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;

        Animated.timing(sheetTranslateY, {
            toValue: 36,
            duration: 180,
            useNativeDriver: true,
        }).start(() => {
            sheetTranslateY.setValue(0);
            isClosingRef.current = false;
            setVisible(false);
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderMove: (_, gestureState) => {
                sheetTranslateY.setValue(Math.max(0, gestureState.dy));
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 120 || gestureState.vy > 1) {
                    closeDropdown();
                    return;
                }

                settleSheet();
            },
            onPanResponderTerminate: settleSheet,
        })
    ).current;

    const openDropdown = () => {
        Keyboard.dismiss();
        isClosingRef.current = false;
        sheetTranslateY.setValue(28);
        setVisible(true);
        requestAnimationFrame(settleSheet);
    };

    const handleSelect = (nextValue: any) => {
        if (multiple) {
            let newValue;
            if (Array.isArray(value)) {
                if (value.includes(nextValue)) {
                    newValue = value.filter((currentValue: any) => currentValue !== nextValue);
                } else {
                    newValue = [...value, nextValue];
                }
            } else {
                newValue = [nextValue];
            }
            onChange(newValue);
            return;
        }

        onChange(nextValue);
        closeDropdown();
    };

    return (
        <View style={customTrigger ? undefined : styles.wrapper}>
            {label && !customTrigger && <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>}

            {customTrigger ? (
                <TouchableOpacity activeOpacity={0.78} onPress={openDropdown}>
                    {customTrigger}
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    activeOpacity={0.78}
                    onPress={openDropdown}
                    style={[styles.trigger, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                    <View style={styles.triggerContent}>
                        {selectedOption?.icon}
                        <View style={styles.triggerTextWrap}>
                            <Text style={[styles.valueText, { color: selectedOption ? theme.colors.text : theme.colors.textSecondary }]} numberOfLines={1}>
                                {selectedOption ? selectedOption.label : placeholder}
                            </Text>
                        </View>
                    </View>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            )}

            <Modal visible={visible} transparent animationType="fade" onRequestClose={closeDropdown}>
                <TouchableWithoutFeedback onPress={closeDropdown}>
                    <View style={styles.bottomSheetOverlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.floatingSheet,
                                    {
                                        backgroundColor: theme.colors.card,
                                        borderColor: theme.colors.border,
                                        transform: [{ translateY: sheetTranslateY }],
                                    },
                                ]}
                            >
                                <View style={styles.dragHeader} {...panResponder.panHandlers}>
                                    <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
                                    {label && <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{label}</Text>}
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                                    {options.length === 0 ? (
                                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No options available.</Text>
                                    ) : (
                                        options.map((option, index) => {
                                            const isSelected = multiple ? Array.isArray(value) && value.includes(option.value) : option.value === value;
                                            return (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() => handleSelect(option.value)}
                                                    style={[
                                                        styles.sheetItem,
                                                        isSelected && !multiple && { backgroundColor: theme.colors.primary + '08' },
                                                    ]}
                                                    activeOpacity={0.78}
                                                >
                                                    <View style={styles.sheetItemContent}>
                                                        {option.icon && (
                                                            <View
                                                                style={[
                                                                    styles.iconWrapper,
                                                                    {
                                                                        backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.background,
                                                                        borderColor: theme.colors.border,
                                                                        borderWidth: isSelected ? 0 : 1,
                                                                    },
                                                                ]}
                                                            >
                                                                {option.icon}
                                                            </View>
                                                        )}
                                                        <View style={styles.sheetTextWrap}>
                                                            <Text
                                                                style={[
                                                                    styles.sheetText,
                                                                    {
                                                                        color: isSelected && !multiple ? theme.colors.primary : theme.colors.text,
                                                                        fontFamily: 'Nunito_600SemiBold',
                                                                    },
                                                                ]}
                                                            >
                                                                {option.label}
                                                            </Text>
                                                            {option.description && (
                                                                <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
                                                                    {option.description}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                    {multiple ? (
                                                        <View pointerEvents="none">
                                                            <Switch
                                                                value={isSelected}
                                                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                                                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (isSelected ? '#FFFFFF' : '#F3F4F6')}
                                                                style={styles.switch}
                                                            />
                                                        </View>
                                                    ) : isSelected ? (
                                                        <HugeiconsIcon icon={Tick01Icon} size={20} color={theme.colors.primary} />
                                                    ) : null}
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </ScrollView>

                                {multiple ? (
                                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                                        <Button title="Done" variant="primary" onPress={closeDropdown} style={{ width: '100%' }} />
                                    </View>
                                ) : null}
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { marginBottom: 20 },
    label: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    trigger: {
        height: 56,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    triggerContent: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    triggerTextWrap: { flex: 1 },
    valueText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },
    bottomSheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.32)',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
    },
    floatingSheet: {
        width: '100%',
        marginBottom: Platform.OS === 'ios' ? 40 : 24,
        borderRadius: 24,
        borderWidth: 1,
        maxHeight: '80%',
    },
    dragHeader: { width: '100%', paddingTop: 12, paddingBottom: 10, alignItems: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginBottom: 2 },
    dragHandle: { width: 42, height: 5, borderRadius: 999, opacity: 0.78, marginBottom: 12 },
    sheetTitle: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.2 },
    sheetContent: { paddingHorizontal: 10, paddingBottom: 18 },
    footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 18, borderTopWidth: 1 },
    emptyText: { textAlign: 'center', fontFamily: 'Nunito_600SemiBold', marginVertical: 20 },
    sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 16, marginBottom: 4 },
    sheetItemContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    sheetTextWrap: { flex: 1 },
    iconWrapper: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sheetText: { fontSize: 15, letterSpacing: -0.2 },
    optionDesc: { fontSize: 12, marginTop: 2, lineHeight: 16, fontFamily: 'Nunito_500Medium' },
    switch: {
        transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
});
