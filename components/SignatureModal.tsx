import {
    Cancel01Icon,
    CheckmarkCircle02Icon,
    Delete02Icon,
    PencilEdit02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { useAppTheme } from '../constants/theme';
import Button from './Button';

export default function SignatureModal({ visible, onClose, onOK, existingSignature }: any) {
    const theme = useAppTheme();
    const ref = useRef<SignatureViewRef>(null);
    const [viewMode, setViewMode] = useState(false);

    useEffect(() => {
        if (visible) {
            setViewMode(!!existingSignature);
        }
    }, [visible, existingSignature]);

    const handleOK = (signature: string) => {
        onOK(signature);
        onClose();
    };

    const handleClear = () => {
        if (viewMode) {
            setViewMode(false);
        } else {
            ref.current?.clearSignature();
        }
    };

    const handleConfirm = () => {
        ref.current?.readSignature();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    
                    {/* CUSTOM HEADER for CLOSE BUTTON VISIBILITY */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        {/* Spacer for centering */}
                        <View style={styles.headerAction} />
                        
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {viewMode ? "Authorized Signature" : "Sign Document"}
                        </Text>
                        
                        <TouchableOpacity 
                            onPress={onClose} 
                            style={[styles.headerAction, { backgroundColor: theme.colors.background }]}
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={[styles.padContainer, { borderColor: theme.colors.border }]}>
                        {viewMode ? (
                            <View style={styles.imagePreview}>
                                <Image 
                                    source={{ uri: existingSignature }} 
                                    style={{ width: '100%', height: '100%' }} 
                                    resizeMode="contain" 
                                />
                            </View>
                        ) : (
                            <SignatureScreen
                                ref={ref}
                                onOK={handleOK}
                                webStyle={`
                                    .m-signature-pad--footer {display: none; margin: 0px;} 
                                    .m-signature-pad {box-shadow: none; border: none;} 
                                    body,html {width: 100%; height: 100%;}
                                `}
                                backgroundColor="transparent"
                                penColor={theme.colors.text}
                            />
                        )}
                    </View>

                    <View style={styles.footer}>
                        <Button 
                            title={viewMode ? "Redraw Signature" : "Clear"} 
                            onPress={handleClear}
                            style={{ flex: 1, backgroundColor: theme.colors.danger + '15' }}
                            textStyle={{ color: theme.colors.danger }}
                            icon={<HugeiconsIcon icon={viewMode ? PencilEdit02Icon : Delete02Icon} size={20} color={theme.colors.danger} />}
                        />
                        {!viewMode && (
                            <Button 
                                title="Save" 
                                variant="primary"
                                onPress={handleConfirm}
                                style={{ flex: 1 }}
                                icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#fff" />}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    card: { height: 480, borderRadius: 24, overflow: 'hidden' },
    
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 16, 
        paddingBottom: 12,
        borderBottomWidth: 1
    },
    title: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    headerAction: { 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    
    padContainer: { flex: 1, backgroundColor: '#fff', borderWidth: 1, margin: 16, borderRadius: 16, overflow: 'hidden' },
    imagePreview: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    footer: { flexDirection: 'row', padding: 16, paddingTop: 0, gap: 12 }
});