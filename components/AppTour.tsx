import {
    ArrowRight01Icon,
    CheckmarkCircle02Icon,
    Rocket01Icon,
    SparklesIcon,
    StarIcon,
    ThumbsUpIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeIn,
    useAnimatedProps,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface TargetLayout {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TourStep {
    id: number;
    title: string;
    description: string;
    target: TargetLayout;
}

interface AppTourProps {
    visible: boolean;
    steps: TourStep[];
    currentStepIndex: number;
    onNext: () => void;
    onSkip: () => void;
    onFinish: () => void;
}

export default function AppTour({ visible, steps, currentStepIndex, onNext, onSkip, onFinish }: AppTourProps) {
    const [showSuccess, setShowSuccess] = useState(false);
    const currentStep = steps[currentStepIndex];
    
    // Animation Values for Spotlight Hole
    const holeX = useSharedValue(0);
    const holeY = useSharedValue(0);
    const holeWidth = useSharedValue(0);
    const holeHeight = useSharedValue(0);

    useEffect(() => {
        if (currentStep && visible && !showSuccess) {
            const padding = 8;
            // Smooth, professional easing without bounce
            const springConfig = { damping: 35, stiffness: 250, mass: 1 }; 
            
            holeX.value = withSpring(currentStep.target.x - padding, springConfig);
            holeY.value = withSpring(currentStep.target.y - padding, springConfig);
            holeWidth.value = withSpring(currentStep.target.width + (padding * 2), springConfig);
            holeHeight.value = withSpring(currentStep.target.height + (padding * 2), springConfig);
        }
    }, [currentStep, visible, showSuccess]);

    const animatedProps = useAnimatedProps(() => ({
        x: holeX.value,
        y: holeY.value,
        width: holeWidth.value,
        height: holeHeight.value,
    }));

    const handleNextAction = () => {
        if (currentStepIndex === steps.length - 1) {
            setShowSuccess(true);
        } else {
            onNext();
        }
    };

    const handleClose = () => {
        setShowSuccess(false);
        onFinish();
    };

    if (!visible) return null;

    const cardStyle = {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    };

    return (
        <Modal transparent animationType="fade" visible={visible}>
            {showSuccess ? (
                // --- SUCCESS SCREEN (Static, No Bounce) ---
                <View style={{ flex: 1, backgroundColor: 'rgba(79, 70, 229, 0.98)', alignItems: 'center', justifyContent: 'center' }}>
                    
                    {/* Static Background Stickers */}
                    <View style={{ position: 'absolute', top: '15%', left: '10%' }}>
                        <HugeiconsIcon icon={StarIcon} size={56} color="#fbbf24" variant="solid" />
                    </View>
                    <View style={{ position: 'absolute', bottom: '20%', right: '10%' }}>
                        <HugeiconsIcon icon={Rocket01Icon} size={64} color="#f472b6" variant="solid" />
                    </View>
                    <View style={{ position: 'absolute', top: '25%', right: '15%' }}>
                        <HugeiconsIcon icon={SparklesIcon} size={48} color="#60a5fa" variant="solid" />
                    </View>
                    <View style={{ position: 'absolute', bottom: '25%', left: '12%' }}>
                        <HugeiconsIcon icon={ThumbsUpIcon} size={52} color="#a78bfa" variant="solid" />
                    </View>

                    <Animated.View 
                        entering={FadeIn.duration(500)}
                        style={{ width: '85%', backgroundColor: 'white', borderRadius: 32, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:10}, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 }}
                    >
                        <View style={{ width: 80, height: 80, backgroundColor: '#dcfce7', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={48} color="#16a34a" variant="solid" />
                        </View>
                        
                        <Text style={{ fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 12, textAlign: 'center' }}>
                            You're All Set!
                        </Text>
                        
                        <Text style={{ fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
                            You are ready to start tracking your work like a pro. Enjoy using DART!
                        </Text>
                        
                        <TouchableOpacity 
                            onPress={handleClose}
                            style={{ backgroundColor: '#4f46e5', width: '100%', paddingVertical: 16, borderRadius: 20, alignItems: 'center', shadowColor: '#4f46e5', shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 8 }}
                        >
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Let's Go!</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            ) : (
                // --- TOUR OVERLAY ---
                <View style={{ flex: 1 }}>
                    <View style={StyleSheet.absoluteFill}>
                        <Svg height="100%" width="100%">
                            <Defs>
                                <Mask id="mask">
                                    <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
                                    <AnimatedRect
                                        animatedProps={animatedProps}
                                        rx={16}
                                        ry={16}
                                        fill="black"
                                    />
                                </Mask>
                            </Defs>
                            <Rect
                                x="0"
                                y="0"
                                width={SCREEN_WIDTH}
                                height={SCREEN_HEIGHT}
                                fill="#4f46e5"
                                fillOpacity="0.85"
                                mask="url(#mask)"
                            />
                        </Svg>
                    </View>

                    {/* Info Card */}
                    {currentStep && (
                        <View 
                            style={{ 
                                position: 'absolute', 
                                top: currentStep.target.y < SCREEN_HEIGHT / 2 
                                    ? currentStep.target.y + currentStep.target.height + 24 
                                    : currentStep.target.y - 200,
                                left: 24, 
                                right: 24 
                            }}
                        >
                            <Animated.View entering={FadeIn.duration(300)} style={cardStyle}>
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#4f46e5', marginBottom: 8 }}>
                                    {currentStep.title}
                                </Text>
                                <Text style={{ fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 24 }}>
                                    {currentStep.description}
                                </Text>
                                
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <TouchableOpacity onPress={onSkip} style={{ padding: 8 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#94a3b8' }}>Skip</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        onPress={handleNextAction} 
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#4f46e5', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 14 }}
                                    >
                                        <Text style={{ color: 'white', fontWeight: 'bold', marginRight: 8 }}>
                                            {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
                                        </Text>
                                        <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                            
                            {/* Pointer Arrow */}
                            <View style={{ 
                                position: 'absolute', 
                                left: 40,
                                [currentStep.target.y < SCREEN_HEIGHT / 2 ? 'top' : 'bottom']: -10,
                                width: 0, 
                                height: 0, 
                                borderLeftWidth: 10, 
                                borderLeftColor: 'transparent', 
                                borderRightWidth: 10, 
                                borderRightColor: 'transparent', 
                                [currentStep.target.y < SCREEN_HEIGHT / 2 ? 'borderBottomWidth' : 'borderTopWidth']: 10, 
                                [currentStep.target.y < SCREEN_HEIGHT / 2 ? 'borderBottomColor' : 'borderTopColor']: 'white' 
                            }} />
                        </View>
                    )}
                </View>
            )}
        </Modal>
    );
}