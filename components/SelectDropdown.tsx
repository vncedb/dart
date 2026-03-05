// filepath: components/SelectDropdown.tsx
import { ArrowDown01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useRef, useState } from 'react';
import {
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
    };

    const closeDropdown = () => {
        setVisible(false);
    };

    const handleSelect = (val: any) => {
        if (multiple) {
            let newValue;
            if (Array.isArray(value)) {
                if (value.includes(val)) {
                    newValue = value.filter((v: any) => v !== val);
                } else {
                    newValue = [...value, val];
                }
            } else {
                newValue = [val];
            }
            onChange(newValue);
        } else {
            onChange(val);
            closeDropdown();
        }
    };

    return (
        <View style={customTrigger ? undefined : styles.wrapper}>
            {label && !customTrigger && <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>}
            
            {customTrigger ? (
                <TouchableOpacity activeOpacity={0.7} onPress={openDropdown}>
                    {customTrigger}
                </TouchableOpacity>
            ) : (
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
            )}

            <Modal visible={visible} transparent animationType="fade" onRequestClose={closeDropdown}>
                <TouchableWithoutFeedback onPress={closeDropdown}>
                    <View style={styles.bottomSheetOverlay}>
                        <TouchableWithoutFeedback>
                            <View 
                                style={[
                                    styles.floatingSheet, 
                                    { 
                                        backgroundColor: theme.colors.card, 
                                        borderColor: theme.colors.border
                                    }
                                ]}
                            >
                                <View style={styles.dragHeader} {...panResponder.panHandlers}>
                                    <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
                                    {label && <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>{label}</Text>}
                                </View>
                                
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                                    {options.length === 0 ? (
                                        <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, fontFamily: 'Nunito_600SemiBold', marginVertical: 20 }}>No options available.</Text>
                                    ) : (
                                        options.map((opt, i) => {
                                            const isSelected = multiple ? (Array.isArray(value) && value.includes(opt.value)) : opt.value === value;
                                            return (
                                                <TouchableOpacity 
                                                    key={i} 
                                                    onPress={() => handleSelect(opt.value)}
                                                    style={[
                                                        styles.sheetItem, 
                                                        isSelected && !multiple && { backgroundColor: theme.colors.primary + '08' }
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
                                                                { color: (isSelected && !multiple) ? theme.colors.primary : theme.colors.text, fontFamily: isSelected ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold' }
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
                                                    {multiple ? (
                                                        <View pointerEvents="none">
                                                            <Switch 
                                                                value={isSelected} 
                                                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }} 
                                                                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (isSelected ? '#FFFFFF' : '#F3F4F6')}
                                                                style={{ 
                                                                    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
                                                                    shadowColor: '#000',
                                                                    shadowOffset: { width: 0, height: 2 },
                                                                    shadowOpacity: 0.1,
                                                                    shadowRadius: 2,
                                                                    elevation: 2
                                                                }}
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
                            </View>
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
        paddingHorizontal: 16 
    },
    valueText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },
    
    bottomSheetOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        justifyContent: 'flex-end',
        paddingHorizontal: 20
    },
    floatingSheet: { 
        width: '100%', 
        marginBottom: Platform.OS === 'ios' ? 40 : 24, 
        borderRadius: 24, 
        borderWidth: 1,
        maxHeight: '80%'
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