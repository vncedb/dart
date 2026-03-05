// filepath: components/InfoTooltip.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Global reference ensures only ONE tooltip exists on screen at a time
let globalTooltipCloser: (() => void) | null = null;

interface InfoTooltipProps {
    text: string;
    children: React.ReactNode;
    containerStyle?: ViewStyle;
    duration?: number;
}

export default function InfoTooltip({ 
    text, 
    children, 
    containerStyle, 
    duration = 2500 
}: InfoTooltipProps) {
    const theme = useAppTheme();
    
    // Controls actual mounting of the Modal
    const [isVisible, setIsVisible] = useState(false);
    
    // Freeze layout data exactly once per press
    const layoutRef = useRef({
        top: undefined as number | undefined,
        bottom: undefined as number | undefined,
        alignItems: 'center' as 'flex-start' | 'center' | 'flex-end',
        arrowLeft: 0,
        isAbove: false,
    });
    
    const targetRef = useRef<View>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const close = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (globalTooltipCloser === close) globalTooltipCloser = null;
        
        // INSTANT DISMISSAL: No exit animation, completely preventing any layout glitches
        setIsVisible(false);
    }, []);

    useEffect(() => {
        return () => {
            if (globalTooltipCloser === close) globalTooltipCloser = null;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [close]);

    const handleLongPress = () => {
        if (globalTooltipCloser && globalTooltipCloser !== close) {
            globalTooltipCloser();
        }

        targetRef.current?.measure((x, y, width, height, pageX, pageY) => {
            const targetCenterX = pageX + width / 2;
            const targetTop = pageY;
            const targetBottom = pageY + height;

            // Smart Edge Detection
            const isAbove = targetTop > 120; // Needs to be above if it's near the bottom

            let horizontalAlign: 'flex-start' | 'center' | 'flex-end' = 'center';
            if (targetCenterX < 100) horizontalAlign = 'flex-start';
            else if (targetCenterX > SCREEN_WIDTH - 100) horizontalAlign = 'flex-end';

            const ARROW_SIZE = 12;
            const SCREEN_MARGIN = 16;
            let arrowLeft = targetCenterX - SCREEN_MARGIN - (ARROW_SIZE / 2);
            
            // Constrain arrow to the safe areas of the tooltip bubble
            if (arrowLeft < 16) arrowLeft = 16;
            if (arrowLeft > SCREEN_WIDTH - (SCREEN_MARGIN * 2) - ARROW_SIZE - 16) {
                arrowLeft = SCREEN_WIDTH - (SCREEN_MARGIN * 2) - ARROW_SIZE - 16;
            }

            // Lock layout configuration values immediately
            layoutRef.current = {
                top: isAbove ? undefined : targetBottom + 8,
                bottom: isAbove ? SCREEN_HEIGHT - targetTop + 8 : undefined,
                alignItems: horizontalAlign,
                arrowLeft,
                isAbove,
            };
            
            setIsVisible(true);
            globalTooltipCloser = close;

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                close();
            }, duration);
        });
    };

    const handlePress = () => {
        if (isVisible) close();
    };

    return (
        <>
            <Pressable 
                ref={targetRef}
                onLongPress={handleLongPress} 
                onPress={handlePress}
                delayLongPress={250}
                style={[styles.container, containerStyle]}
                hitSlop={8}
            >
                {children}
            </Pressable>
            
            {isVisible && (
                <Modal transparent visible={true} animationType="none" onRequestClose={close}>
                    {/* Instant Dismiss Overlay */}
                    <Pressable style={styles.overlay} onPress={close}>
                        
                        <Animated.View 
                            // Reanimated intercepts the native paint cycle for a perfectly smooth fade-in
                            entering={FadeIn.duration(150).easing(Easing.out(Easing.quad))}
                            style={[
                                styles.tooltipWrapper, 
                                {
                                    alignItems: layoutRef.current.alignItems,
                                    top: layoutRef.current.top,
                                    bottom: layoutRef.current.bottom,
                                }
                            ]}
                        >
                            <View style={[styles.tooltipBubble, { backgroundColor: theme.colors.text }]}>
                                <Text style={[styles.tooltipText, { color: theme.colors.card }]}>{text}</Text>
                            </View>
                            
                            <View style={[
                                styles.arrow,
                                { 
                                    backgroundColor: theme.colors.text,
                                    left: layoutRef.current.arrowLeft,
                                    // Arrow positioning is strictly locked by the layout ref
                                    ...(layoutRef.current.isAbove ? { bottom: -4 } : { top: -4 })
                                }
                            ]} />
                        </Animated.View>
                        
                    </Pressable>
                </Modal>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    tooltipWrapper: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
    },
    tooltipBubble: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        maxWidth: 240, 
    },
    tooltipText: {
        fontSize: 12,
        fontFamily: 'Nunito_800ExtraBold',
        textAlign: 'center',
    },
    arrow: {
        width: 12,
        height: 12,
        position: 'absolute',
        transform: [{ rotate: '45deg' }],
        zIndex: -1,
    },
});