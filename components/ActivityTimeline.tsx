import {
    Delete02Icon,
    HourglassIcon,
    Image02Icon,
    Login03Icon,
    Logout03Icon,
    PencilEdit02Icon,
    RefreshIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ImageViewer from './ImageViewer';

const ActivityImageContent = ({ uri, theme, onPress }: { uri: string, theme: any, onPress?: () => void }) => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [key, setKey] = useState(0);
    const handleRetry = () => { setStatus('loading'); setKey(prev => prev + 1); };

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ flex: 1 }}>
            <Image
                key={key}
                source={{ uri }}
                style={[StyleSheet.absoluteFill, { opacity: status === 'success' ? 1 : 0 }]}
                resizeMode="cover"
                onLoad={() => setStatus('success')}
                onError={() => setStatus('error')}
            />
            {status === 'loading' && (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
            )}
            {status === 'error' && (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card }]}>
                    <HugeiconsIcon icon={Image02Icon} size={32} color={theme.colors.icon} />
                    <TouchableOpacity onPress={handleRetry} style={{ marginTop: 8 }}>
                        <HugeiconsIcon icon={RefreshIcon} size={14} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
};

const ActivityGallery = ({ uri, theme, onImagePress }: { uri: string, theme: any, onImagePress: (uri: string) => void }) => {
    const [images, setImages] = useState<string[]>([]);
    const [containerWidth, setContainerWidth] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(1);

    useEffect(() => {
        if (!uri) return;
        try {
            const parsed = JSON.parse(uri);
            if (Array.isArray(parsed)) setImages(parsed);
            else setImages([uri]);
        } catch {
            setImages([uri]);
        }
    }, [uri]);

    const handleScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        if (slideSize > 0) {
            const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
            setCurrentIndex(index + 1);
        }
    };

    if (images.length === 0) return null;

    return (
        <View
            style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: theme.colors.card, marginTop: 8 }}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            {containerWidth > 0 && (
                <ScrollView 
                    horizontal 
                    pagingEnabled 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ width: containerWidth * images.length }}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    {images.map((imgUri, index) => (
                        <View key={index} style={{ width: containerWidth, height: '100%' }}>
                            <ActivityImageContent uri={imgUri} theme={theme} onPress={() => onImagePress(imgUri)} />
                        </View>
                    ))}
                </ScrollView>
            )}
            {images.length > 1 && (
                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{currentIndex} / {images.length}</Text>
                </View>
            )}
        </View>
    );
};

interface ActivityTimelineProps {
    timelineData: any[];
    theme: any;
    onEditTask: (task: any) => void;
    onDeleteTask: (task: any) => void;
}

export default function ActivityTimeline({ timelineData, theme, onEditTask, onDeleteTask }: ActivityTimelineProps) {
    const [viewerVisible, setViewerVisible] = useState(false);
    const [activeImageUri, setActiveImageUri] = useState<string | null>(null);

    const openViewer = (uri: string) => {
        setActiveImageUri(uri);
        setViewerVisible(true);
    };

    if (timelineData.length === 0) {
        return (
            <View style={{ alignItems: 'center', padding: 20, opacity: 0.5 }}>
                <HugeiconsIcon icon={HourglassIcon} size={32} color={theme.colors.icon} />
                <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontSize: 12 }}>No activity yet.</Text>
            </View>
        );
    }

    return (
        <View>
            <ImageViewer visible={viewerVisible} imageUri={activeImageUri} onClose={() => setViewerVisible(false)} />
            
            <View style={{ borderLeftWidth: 2, borderLeftColor: theme.colors.border, marginLeft: 8, paddingLeft: 16 }}>
                {timelineData.map((item: any) => (
                    <View key={item.type === 'task' ? `task-${item.data.id}` : `${item.type}-${item.id}`} style={{ marginBottom: 24 }}>
                        <View style={{ position: 'absolute', left: -32, top: '50%', marginTop: -16 }}>
                            {item.type === 'check-in' ? (
                                <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 4, borderWidth: 2, borderColor: theme.colors.success }}>
                                    <HugeiconsIcon icon={Login03Icon} size={16} color={theme.colors.success} />
                                </View>
                            ) : item.type === 'check-out' ? (
                                <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 4, borderWidth: 2, borderColor: theme.colors.warning }}>
                                    <HugeiconsIcon icon={Logout03Icon} size={16} color={theme.colors.warning} />
                                </View>
                            ) : (
                                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.card, borderWidth: 3, borderColor: theme.colors.primary, marginLeft: 10 }} />
                            )}
                        </View>

                        {item.type === 'task' ? (
                            <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
                                <View style={{ padding: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', opacity: 0.8 }}>
                                            {format(new Date(item.data.created_at), 'h:mm a')}
                                        </Text>
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <TouchableOpacity onPress={() => onEditTask(item.data)} hitSlop={10}>
                                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => onDeleteTask(item.data)} hitSlop={10}>
                                                <HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: item.data.remarks ? 4 : 0 }}>
                                        {item.data.description}
                                    </Text>
                                    {item.data.remarks && <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{item.data.remarks}</Text>}
                                </View>
                                {item.data.image_url && <ActivityGallery uri={item.data.image_url} theme={theme} onImagePress={openViewer} />}
                            </View>
                        ) : (
                            <View style={{ justifyContent: 'center', minHeight: 32 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginRight: 8 }}>{item.type === 'check-in' ? 'Checked In' : 'Checked Out'}</Text>
                                    {item.isOvertime && <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.warning }}>OT</Text>}
                                </View>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{format(new Date(item.time), 'h:mm a')}</Text>
                            </View>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
}