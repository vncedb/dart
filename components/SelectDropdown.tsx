import { ArrowDown01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [layout, setLayout] = useState<any>(null);
    
    const triggerRef = useRef<View>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const translateAnim = useRef(new Animated.Value(-10)).current;

    const selectedOption = options.find(o => o.value === value);

    const openDropdown = () => {
        Keyboard.dismiss();
        
        triggerRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
            const windowHeight = Dimensions.get('window').height;
            const headerHeight = 44;
            const itemHeight = 60; // Approx
            const maxContentHeight = 280;
            const calculatedHeight = Math.min((options.length * itemHeight) + headerHeight, maxContentHeight);
            
            // Calculate space below the trigger
            const spaceBelow = windowHeight - (y + height + insets.bottom + 120);
            
            // If space below is too small, render ABOVE
            const showAbove = spaceBelow < calculatedHeight && y > calculatedHeight;
            
            // Exact Y position: 
            // If above: y - calculatedHeight - margin
            // If below: y + height + margin
            const finalY = showAbove ? (y - calculatedHeight + 40) : (y + height + 40);
            
            setLayout({
                x: x,
                y: finalY,
                width: width,
                height: calculatedHeight,
                showAbove
            });

            setVisible(true);

            // Animate In
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.95);
            translateAnim.setValue(showAbove ? 10 : -10);

            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, damping: 20, stiffness: 300, useNativeDriver: true }),
                Animated.timing(translateAnim, { toValue: 0, duration: 200, useNativeDriver: true })
            ]).start();
        });
    };

    const closeDropdown = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true })
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
                ref={triggerRef}
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
                <Pressable style={styles.overlay} onPress={closeDropdown}>
                    {layout && (
                        <Animated.View 
                            style={[
                                styles.dropdown,
                                { 
                                    top: layout.y, 
                                    left: layout.x, 
                                    width: layout.width,
                                    height: layout.height,
                                    backgroundColor: theme.colors.card, 
                                    borderColor: theme.colors.border,
                                    opacity: fadeAnim,
                                    transform: [
                                        { translateY: translateAnim },
                                        { scale: scaleAnim }
                                    ]
                                }
                            ]}
                        >
                            {/* Dropdown Header */}
                            <View style={[styles.dropdownHeader, { borderBottomColor: theme.colors.border }]}>
                                <Text style={[styles.headerTitle, { color: theme.colors.textSecondary }]}>
                                    Select {label || 'Option'}
                                </Text>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 6 }}>
                                {options.map((opt, i) => {
                                    const isSelected = opt.value === value;
                                    return (
                                        <TouchableOpacity 
                                            key={i} 
                                            onPress={() => handleSelect(opt.value)}
                                            style={[
                                                styles.optionItem, 
                                                isSelected && { backgroundColor: theme.colors.primary + '10' }
                                            ]}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                                {opt.icon}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[
                                                        styles.optionLabel, 
                                                        { color: isSelected ? theme.colors.primary : theme.colors.text }
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
                                                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color={theme.colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </Animated.View>
                    )}
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { marginBottom: 20 },
    label: { fontSize: 11, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    trigger: { 
        height: 56, 
        borderRadius: 12, 
        borderWidth: 1, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16 
    },
    valueText: { fontSize: 15, fontWeight: '600' },
    
    overlay: { flex: 1 },
    dropdown: { 
        position: 'absolute',
        borderRadius: 14, 
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        overflow: 'hidden',
    },
    dropdownHeader: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        backgroundColor: 'rgba(0,0,0,0.02)',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        opacity: 0.7
    },
    
    optionItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        borderRadius: 8, 
        marginBottom: 2,
    },
    optionLabel: { fontSize: 14, fontWeight: '600' },
    optionDesc: { fontSize: 11, marginTop: 2, lineHeight: 14 }
});