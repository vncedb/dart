import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/constants/theme';
import { Typography } from '@/constants/typography';
import { SkeletonBlock, SkeletonCircle } from './Skeleton';

interface LoadingScreenProps {
    message?: string;
    variant?: 'profile' | 'reports' | 'jobs' | 'edit-profile' | 'job-form' | 'generic';
}

const SectionLabel = () => <SkeletonBlock style={{ width: 110, height: 12, borderRadius: 6, marginBottom: 14 }} />;

const FieldSkeleton = ({ labelWidth = 120 }: { labelWidth?: number }) => (
    <View style={{ marginBottom: 20 }}>
        <SkeletonBlock style={{ width: labelWidth, height: 10, borderRadius: 5, marginBottom: 8, marginLeft: 4 }} />
        <SkeletonBlock style={{ width: '100%', height: 56, borderRadius: 16 }} />
    </View>
);

const ScreenHeaderSkeleton = ({ titleWidth = 120 }: { titleWidth?: number }) => (
    <View style={styles.screenHeaderShell}>
        <SkeletonCircle size={40} />
        <SkeletonBlock style={{ width: titleWidth, height: 20, borderRadius: 10 }} />
        <View style={{ width: 40 }} />
    </View>
);
function ProfileSkeleton() {
    const theme = useAppTheme();

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileHero}>
                <View style={styles.avatarShell}>
                    <View style={[styles.avatarRing, { borderColor: theme.colors.border }]}> 
                        <SkeletonCircle size={114} />
                    </View>
                    <View style={[styles.avatarEditBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <SkeletonCircle size={16} />
                    </View>
                </View>

                <SkeletonBlock style={{ width: 178, height: 28, borderRadius: 12, marginTop: 24 }} />
                <SkeletonBlock style={{ width: 102, height: 30, borderRadius: 15, marginTop: 12 }} />
                <SkeletonBlock style={{ width: 210, height: 14, borderRadius: 7, marginTop: 12 }} />

                <View style={styles.profileActionRow}>
                    <SkeletonBlock style={styles.profileActionButton} />
                    <SkeletonBlock style={styles.profileActionButton} />
                </View>
            </View>

            <View style={styles.sectionContainer}>
                <SectionLabel />
                <View style={[styles.jobCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                    <View style={[styles.jobCardAccent, { backgroundColor: theme.colors.border }]} />
                    <View style={[styles.jobCardHeader, { borderBottomColor: theme.colors.border }]}> 
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <SkeletonBlock style={{ width: '62%', height: 22, borderRadius: 8, marginBottom: 8 }} />
                            <SkeletonBlock style={{ width: '48%', height: 13, borderRadius: 6 }} />
                        </View>
                        <SkeletonCircle size={36} />
                    </View>
                    <View style={styles.jobGrid}>
                        {[0, 1, 2, 3].map((item) => (
                            <View key={item} style={styles.jobGridItem}>
                                <View style={styles.jobDetailRow}>
                                    <SkeletonCircle size={28} />
                                    <View style={{ flex: 1 }}>
                                        <SkeletonBlock style={{ width: '70%', height: 10, borderRadius: 5, marginBottom: 6 }} />
                                        <SkeletonBlock style={{ width: '86%', height: 14, borderRadius: 7 }} />
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

function ReportsSkeleton() {
    const theme = useAppTheme();

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.reportsFilterContainer}>
                <View style={[styles.reportsFilterBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                    <SkeletonCircle size={44} />
                    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 12 }}>
                        <SkeletonBlock style={{ width: 78, height: 10, borderRadius: 5, marginBottom: 8 }} />
                        <SkeletonBlock style={{ width: 190, height: 16, borderRadius: 8 }} />
                    </View>
                    <SkeletonCircle size={44} />
                </View>
            </View>

            <View style={{ paddingTop: 8 }}>
                {[0, 1].map((section) => (
                    <View key={section} style={{ marginBottom: 12 }}>
                        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                            <SkeletonBlock style={{ width: 140, height: 12, borderRadius: 6 }} />
                        </View>
                        {[0, 1].map((item) => (
                            <View key={`${section}-${item}`} style={[styles.reportItemShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                                <View style={[styles.reportDateBadge, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}> 
                                    <SkeletonBlock style={{ width: 24, height: 8, borderRadius: 4, marginBottom: 6 }} />
                                    <SkeletonBlock style={{ width: 22, height: 18, borderRadius: 8, marginBottom: 6 }} />
                                    <SkeletonBlock style={{ width: 28, height: 12, borderRadius: 6 }} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <SkeletonBlock style={{ width: '64%', height: 18, borderRadius: 8, marginBottom: 10 }} />
                                    <View style={{ flexDirection: 'row', gap: 16 }}>
                                        <SkeletonBlock style={{ width: 86, height: 13, borderRadius: 6 }} />
                                        <SkeletonBlock style={{ width: 72, height: 13, borderRadius: 6 }} />
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 6, marginLeft: 12 }}>
                                    <View style={styles.reportTagRow}>
                                        <SkeletonBlock style={styles.reportTag} />
                                        <SkeletonBlock style={styles.reportTag} />
                                    </View>
                                    <SkeletonBlock style={{ width: 12, height: 12, borderRadius: 6 }} />
                                </View>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

function JobsSkeleton() {
    const theme = useAppTheme();

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.jobsHeroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                <View style={styles.jobsHeroHeader}>
                    <SkeletonBlock style={{ width: 130, height: 28, borderRadius: 14 }} />
                    <SkeletonCircle size={38} />
                </View>
                <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
                    <SkeletonBlock style={{ width: '58%', height: 28, borderRadius: 10, marginBottom: 14 }} />
                    <SkeletonBlock style={{ width: '42%', height: 14, borderRadius: 7, marginBottom: 10 }} />
                    <SkeletonBlock style={{ width: '34%', height: 14, borderRadius: 7, marginBottom: 18 }} />
                    <SkeletonBlock style={{ width: 110, height: 28, borderRadius: 14 }} />
                </View>
            </View>

            <View style={{ marginTop: 24 }}>
                <SectionLabel />
                {[0, 1].map((item) => (
                    <View key={item} style={[styles.jobListShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                        <View style={{ flex: 1 }}>
                            <SkeletonBlock style={{ width: '54%', height: 18, borderRadius: 8, marginBottom: 10 }} />
                            <SkeletonBlock style={{ width: '70%', height: 13, borderRadius: 6, marginBottom: 10 }} />
                            <SkeletonBlock style={{ width: 90, height: 24, borderRadius: 12 }} />
                        </View>
                        <SkeletonBlock style={{ width: 66, height: 38, borderRadius: 19, marginLeft: 16 }} />
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

function EditProfileSkeleton() {
    const theme = useAppTheme();

    return (
        <ScrollView contentContainerStyle={styles.formScrollContent} showsVerticalScrollIndicator={false}>
            <ScreenHeaderSkeleton titleWidth={110} />

            <SectionLabel />
            <View style={[styles.formCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <FieldSkeleton labelWidth={42} />
                <FieldSkeleton labelWidth={130} />
            </View>

            <SectionLabel />
            <View style={[styles.formCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <FieldSkeleton labelWidth={92} />
                <FieldSkeleton labelWidth={102} />
                <FieldSkeleton labelWidth={88} />
            </View>
        </ScrollView>
    );
}

function JobFormSkeleton() {
    const theme = useAppTheme();

    return (
        <ScrollView contentContainerStyle={styles.formScrollContent} showsVerticalScrollIndicator={false}>
            <ScreenHeaderSkeleton titleWidth={96} />

            <SectionLabel />
            <View style={[styles.formCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <FieldSkeleton labelWidth={76} />
                <FieldSkeleton labelWidth={110} />
                <FieldSkeleton labelWidth={88} />
                <FieldSkeleton labelWidth={118} />
                <FieldSkeleton labelWidth={84} />
            </View>

            <SectionLabel />
            <View style={[styles.formCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <FieldSkeleton labelWidth={74} />
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {[0, 1, 2].map((item) => (
                        <SkeletonBlock key={item} style={{ flex: 1, height: 40, borderRadius: 12 }} />
                    ))}
                </View>
                <SkeletonBlock style={{ width: 150, height: 10, borderRadius: 5, marginBottom: 8, marginLeft: 4 }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    {[0, 1, 2, 3].map((item) => (
                        <SkeletonBlock key={item} style={{ width: '48%', height: 56, borderRadius: 16 }} />
                    ))}
                </View>
                <FieldSkeleton labelWidth={138} />
            </View>

            <View style={[styles.summaryCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                <SkeletonBlock style={{ width: 164, height: 10, borderRadius: 5, marginBottom: 8 }} />
                <SkeletonBlock style={{ width: '46%', height: 28, borderRadius: 10, marginBottom: 8 }} />
                <SkeletonBlock style={{ width: '72%', height: 12, borderRadius: 6 }} />
            </View>

            <SectionLabel />
            <View style={[styles.formCardShell, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <SkeletonBlock style={{ flex: 1, height: 88, borderRadius: 16 }} />
                    <SkeletonBlock style={{ flex: 1, height: 88, borderRadius: 16 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <SkeletonBlock style={{ width: 98, height: 10, borderRadius: 5 }} />
                    <SkeletonBlock style={{ width: 54, height: 16, borderRadius: 8 }} />
                </View>
                {[0, 1].map((item) => (
                    <View key={item} style={[styles.breakShell, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}> 
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                            <SkeletonBlock style={{ width: 92, height: 14, borderRadius: 7 }} />
                            <SkeletonBlock style={{ width: 16, height: 16, borderRadius: 8 }} />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <SkeletonBlock style={{ flex: 1, height: 46, borderRadius: 10 }} />
                            <SkeletonBlock style={{ flex: 1, height: 46, borderRadius: 10 }} />
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

function GenericSkeleton({ message }: { message: string }) {
    return (
        <View style={styles.genericContainer}>
            <SkeletonBlock style={{ width: 220, height: 22, borderRadius: 11, marginBottom: 16 }} />
            <SkeletonBlock style={{ width: 280, height: 14, borderRadius: 7, marginBottom: 12 }} />
            <SkeletonBlock style={{ width: 240, height: 14, borderRadius: 7 }} />
            <Text style={styles.genericText}>{message}</Text>
        </View>
    );
}

export default function LoadingScreen({ message = 'Loading...', variant = 'generic' }: LoadingScreenProps) {
    const theme = useAppTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
            {variant === 'profile' ? <ProfileSkeleton /> : null}
            {variant === 'reports' ? <ReportsSkeleton /> : null}
            {variant === 'jobs' ? <JobsSkeleton /> : null}
            {variant === 'edit-profile' ? <EditProfileSkeleton /> : null}
            {variant === 'job-form' ? <JobFormSkeleton /> : null}
            {variant === 'generic' ? <GenericSkeleton message={message} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    formScrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
    screenHeaderShell: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    formCardShell: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
    },
    summaryCardShell: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginTop: -6,
        marginBottom: 20,
    },
    breakShell: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
    },
    profileHero: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 24,
    },
    avatarShell: {
        position: 'relative',
    },
    avatarRing: {
        width: 128,
        height: 128,
        borderRadius: 64,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEditBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        bottom: 6,
        right: 6,
    },
    profileActionRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 18,
        width: '100%',
    },
    profileActionButton: {
        flex: 1,
        height: 46,
        borderRadius: 16,
    },
    sectionContainer: {
        paddingHorizontal: 24,
    },
    jobCardShell: {
        borderWidth: 1,
        borderRadius: 20,
        overflow: 'hidden',
    },
    jobCardAccent: {
        height: 4,
        width: '100%',
        opacity: 0.8,
    },
    jobCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 20,
        borderBottomWidth: 1,
    },
    jobGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        paddingTop: 16,
        paddingBottom: 6,
    },
    jobGridItem: {
        width: '50%',
        paddingHorizontal: 8,
        marginBottom: 18,
    },
    jobDetailRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
    },
    reportsFilterContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    reportsFilterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 999,
        borderWidth: 1,
    },
    reportItemShell: {
        marginHorizontal: 20,
        marginBottom: 10,
        borderWidth: 1,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    reportDateBadge: {
        width: 52,
        height: 64,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        marginRight: 12,
    },
    reportTagRow: {
        flexDirection: 'row',
        gap: 4,
    },
    reportTag: {
        width: 24,
        height: 24,
        borderRadius: 6,
    },
    jobsHeroCard: {
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        marginHorizontal: 24,
    },
    jobsHeroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 18,
    },
    jobListShell: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
    },
    genericContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    genericText: {
        ...Typography.bodySemibold,
        color: '#94a3b8',
        marginTop: 18,
        letterSpacing: 0.3,
    },
});
