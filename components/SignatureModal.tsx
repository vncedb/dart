import React, { useRef } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { useAppTheme } from '../constants/theme';

interface SignatureModalProps {
    visible: boolean;
    onClose: () => void;
    onOK: (signature: string) => void;
}

export default function SignatureModal({ visible, onClose, onOK }: SignatureModalProps) {
    const theme = useAppTheme();
    const ref = useRef<SignatureViewRef>(null);

    const handleOK = (signature: string) => {
        onOK(signature); // Signature is base64 string
        onClose();
    };

    const handleClear = () => {
        ref.current?.clearSignature();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text }}>Sign Here</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ color: theme.colors.primary, fontSize: 16 }}>Close</Text>
                    </TouchableOpacity>
                </View>
                
                <View style={{ flex: 1 }}>
                    <SignatureScreen
                        ref={ref}
                        onOK={handleOK}
                        webStyle={`
                            .m-signature-pad--footer {display: none; margin: 0px;} 
                            body,html {width: 100%; height: 100%;}
                        `} 
                        backgroundColor={theme.colors.background === '#000' ? '#fff' : '#fff'} // Canvas usually needs white bg
                        descriptionText="Sign above"
                    />
                </View>

                <View style={{ padding: 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                     <TouchableOpacity onPress={handleClear} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: theme.colors.dangerLight, alignItems: 'center' }}>
                         <Text style={{ fontWeight: 'bold', color: theme.colors.danger }}>Clear</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => ref.current?.readSignature()} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center' }}>
                         <Text style={{ fontWeight: 'bold', color: '#fff' }}>Save Signature</Text>
                     </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}