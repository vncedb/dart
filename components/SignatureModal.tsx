// filepath: components/SignatureModal.tsx
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const handleCanvasLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setCanvasSize({ width, height });
        }
    };

    const resetCanvas = () => {
        setCanvasSize({ width: 0, height: 0 });
    };

    // Forces a fresh un-cached layout when switching signers
    const canvasKey = `${title}-${visible ? 'open' : 'closed'}`;

    useEffect(() => {
        if (visible) {
            setHasDrawn(false);
            setAlertVisible(false);
            resetCanvas();
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
    };

    const handleConfirm = () => {
        ref.current?.readSignature(); 
    };

    const handleClose = () => {
        ref.current?.clearSignature();
        onClose();
    }

    const webStyle = `
        .m-signature-pad { box-shadow: none; border: none; margin: 0; padding: 0; }
        .m-signature-pad--body { border: none; bottom: 0px; }
        .m-signature-pad--footer { display: none; margin: 0; }
        body, html { width: 100%; height: 100%; background-color: transparent; padding: 0; margin: 0; }
    `;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
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
                        <TouchableOpacity onPress={handleClose} style={[styles.headerAction, { backgroundColor: theme.colors.background }]}>
                            <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* CANVAS AREA */}
                    <View style={[styles.padContainer, { borderColor: theme.colors.border }]}>
                        <View style={styles.canvasWrapper} onLayout={handleCanvasLayout}>
                            {canvasSize.width > 0 && (
                                <SignatureScreen
                                    key={canvasKey}
                                    ref={ref}
                                    onOK={handleOK}
                                    onEmpty={handleEmpty}
                                    onBegin={() => setHasDrawn(true)}
                                    webStyle={webStyle}
                                    backgroundColor="rgba(255,255,255,0)"
                                    imageType="image/png"
                                    penColor={theme.dark ? "#FFFFFF" : "#000000"}
                                    style={{ width: canvasSize.width, height: canvasSize.height }}
                                />
                            )}
                        </View>
                        {!hasDrawn && (
                            <View style={styles.signingHint}>
                                <Text style={[styles.signingHintText, { color: theme.colors.textSecondary }]}>
                                    Sign in the box above
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* FOOTER ACTIONS */}
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
    overlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        justifyContent: 'center', 
        padding: 24 
    },
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
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 16, 
        paddingBottom: 16,
        borderBottomWidth: 1
    },
    title: { 
        fontSize: 16, 
        fontFamily: 'Nunito_800ExtraBold', 
        textTransform: 'uppercase', 
        letterSpacing: 0.5 
    },
    headerAction: { 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    padContainer: { 
        flex: 1, 
        backgroundColor: 'transparent', 
        borderWidth: 1, 
        margin: 20, 
        borderRadius: 20, 
        overflow: 'hidden', 
        position: 'relative' 
    },
    canvasWrapper: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
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
        opacity: 0.4
    },
    footer: { 
        flexDirection: 'row', 
        padding: 20, 
        paddingTop: 0 
    }
});