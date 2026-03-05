// filepath: components/SelectDropdown.tsx
import { ArrowDown01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
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
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useAppTheme } from '../constants/theme';

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
}

export default function SelectDropdown({ label, value, options, onChange, placeholder = 'Select' }: SelectDropdownProps) {
    const theme = useAppTheme();
    const [visible, setVisible] = useState(false);
    
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateYAnim = useRef(new Animated.Value(300)).current;

    const selectedOption = options.find(o => o.value === value);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 50 || gestureState.vy > 0.5) {
                    closeDropdown();
                }
            },
        })
    ).current;

    const openDropdown = () => {
        Keyboard.dismiss();
        setVisible(true);

        fadeAnim.setValue(0);
        translateYAnim.setValue(300);

        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(translateYAnim, { toValue: 0, damping: 25, stiffness: 300, useNativeDriver: true })
        ]).start();
    };

    const closeDropdown = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(translateYAnim, { toValue: 300, duration: 200, useNativeDriver: true })
        ]).start(() => setVisible(false));
    };

    const handleSelect = (val: any) => {
        onChange(val);
        closeDropdown();
    };

    return (
        <View style={styles.wrapper}>
            {label && <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>}
            
            <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={openDropdown} 
                style={[styles.trigger, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
                <View style={{flexDirection:'row', alignItems:'center', gap: 10, flex: 1}}>
                    {selectedOption?.icon}
                    <View style={{flex: 1}}>
                        <Text style={[styles.valueText, { color: selectedOption ? theme.colors.text : theme.colors.textSecondary }]} numberOfLines={1}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </Text>
                    </View>
                </View>
                <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="none" onRequestClose={closeDropdown}>
                <TouchableWithoutFeedback onPress={closeDropdown}>
                    <Animated.View style={[styles.bottomSheetOverlay, { opacity: fadeAnim }]}>
                        <TouchableWithoutFeedback>
                            <Animated.View 
                                style={[
                                    styles.floatingSheet, 
                                    { 
                                        backgroundColor: theme.colors.card, 
                                        borderColor: theme.colors.border,
                                        transform: [{ translateY: translateYAnim }]
                                    }
                                ]}
                            >
                                <View style={styles.dragHeader} {...panResponder.panHandlers}>
                                    <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
                                    {label && <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{label}</Text>}
                                </View>
                                
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                                    {options.map((opt, i) => {
                                        const isSelected = opt.value === value;
                                        return (
                                            <TouchableOpacity 
                                                key={i} 
                                                onPress={() => handleSelect(opt.value)}
                                                style={[
                                                    styles.sheetItem, 
                                                    isSelected && { backgroundColor: theme.colors.primary + '08' }
                                                ]}
                                                activeOpacity={0.7}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                                    {opt.icon && (
                                                        <View style={[styles.iconWrapper, { backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.background, borderColor: theme.colors.border, borderWidth: isSelected ? 0 : 1 }]}>
                                                            {opt.icon}
                                                        </View>
                                                    )}
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[
                                                            styles.sheetText, 
                                                            { color: isSelected ? theme.colors.primary : theme.colors.text, fontFamily: isSelected ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold' }
                                                        ]}>
                                                            {opt.label}
                                                        </Text>
                                                        {opt.description && (
                                                            <Text style={[styles.optionDesc, { color: theme.colors.textSecondary }]}>
                                                                {opt.description}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                                {isSelected && (
                                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={theme.colors.primary} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
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
        paddingHorizontal: 16 
    },
    valueText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },
    
    bottomSheetOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        justifyContent: 'flex-end',
        paddingHorizontal: 16
    },
    floatingSheet: { 
        width: '100%', 
        marginBottom: Platform.OS === 'ios' ? 40 : 24, 
        borderRadius: 24, 
        borderWidth: 1,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10
    },
    dragHeader: { width: '100%', paddingVertical: 14, alignItems: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginBottom: 4 },
    dragHandle: { width: 36, height: 4, borderRadius: 2, opacity: 0.8, marginBottom: 12 },
    sheetTitle: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.2 },
    
    sheetContent: { paddingHorizontal: 10, paddingBottom: 16 },
    sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, marginBottom: 4 },
    iconWrapper: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sheetText: { fontSize: 15, letterSpacing: -0.2 },
    optionDesc: { fontSize: 12, marginTop: 2, lineHeight: 16, fontFamily: 'Nunito_500Medium' }
});