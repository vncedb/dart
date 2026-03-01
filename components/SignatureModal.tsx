// filepath: components/SignatureModal.tsx
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';

import { useAppTheme } from '../constants/theme';
import Button from './Button';
import FloatingAlert from './FloatingAlert';

interface SignatureModalProps {
    visible: boolean;
    onClose: () => void;
    onOK: (signature: string) => void;
    title?: string;
}

export default function SignatureModal({ 
    visible, 
    onClose, 
    onOK, 
    title = "Sign Document" 
}: SignatureModalProps) {
    const theme = useAppTheme();
    const ref = useRef<SignatureViewRef>(null);
    
    const [hasDrawn, setHasDrawn] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            setHasDrawn(false);
            setAlertVisible(false);
            // Wait slightly for the WebView to be ready, then clear any old strokes
            setTimeout(() => {
                ref.current?.clearSignature();
            }, 150);
        }
    }, [visible]);

    const handleOK = (signature: string) => {
        onOK(signature);
        onClose();
    };

    const handleEmpty = () => {
        setAlertVisible(true);
    };

    const handleClear = () => {
        ref.current?.clearSignature();
        setHasDrawn(false);
        setAlertVisible(false);
    };

    const handleConfirm = () => {
        ref.current?.readSignature(); 
    };

    // Forces a pure white piece of paper without native webview footers
    const webStyle = `
        .m-signature-pad { box-shadow: none; border: none; margin: 0; padding: 0; background-color: #ffffff; }
        .m-signature-pad--body { border: none; bottom: 0px; background-color: #ffffff; }
        .m-signature-pad--footer { display: none; margin: 0; }
        body, html { width: 100%; height: 100%; background-color: #ffffff; padding: 0; margin: 0; overflow: hidden; }
    `;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
                    
                    <FloatingAlert 
                        visible={alertVisible} 
                        message="Please provide a signature first." 
                        type="warning" 
                        onHide={() => setAlertVisible(false)} 
                        position="top"
                    />

                    {/* HEADER */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <View style={styles.headerAction} />
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {title}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={[styles.headerAction, { backgroundColor: theme.colors.background }]}>
                            <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* CANVAS AREA - Hardcoded Black Ink on White Paper for Maximum Compatibility */}
                    <View style={[styles.padContainer, { borderColor: theme.colors.border }]}>
                        <View style={styles.canvasWrapper}>
                            <SignatureScreen
                                ref={ref}
                                onOK={handleOK}
                                onEmpty={handleEmpty}
                                onBegin={() => setHasDrawn(true)}
                                webStyle={webStyle}
                                backgroundColor="#ffffff"
                                penColor="#000000"
                                imageType="image/png"
                            />
                        </View>
                        {!hasDrawn && (
                            <View style={styles.signingHint}>
                                <Text style={styles.signingHintText}>
                                    Sign in the box above
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* FOOTER ACTIONS - NO ICONS */}
                    <View style={styles.footer}>
                        <Button 
                            title="Clear" 
                            variant="outline"
                            onPress={handleClear}
                            style={{ flex: 1 }}
                        />
                        <View style={{ width: 12 }} />
                        <Button 
                            title="Save" 
                            variant="primary"
                            onPress={handleConfirm}
                            style={{ flex: 1 }}
                        />
                    </View>

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    card: { 
        height: 500, 
        borderRadius: 28, 
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 16, borderBottomWidth: 1 },
    title: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
    headerAction: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    
    padContainer: { 
        flex: 1, 
        backgroundColor: '#ffffff', 
        borderWidth: 1, 
        margin: 20, 
        borderRadius: 20, 
        overflow: 'hidden', 
        position: 'relative' 
    },
    canvasWrapper: { flex: 1, width: '100%', height: '100%' },
    
    signingHint: {
        position: 'absolute',
        bottom: 20,
        width: '100%',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    signingHintText: {
        fontSize: 13,
        fontFamily: 'Nunito_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#9CA3AF'
    },
    footer: { flexDirection: 'row', padding: 20, paddingTop: 0 }
});