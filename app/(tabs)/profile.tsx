import {
  ArrowLeftRightIcon,
  Briefcase01Icon,
  Calendar03Icon,
  Clock01Icon,
  Money03Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  RepeatIcon,
  Settings02Icon,
  UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

// --- THEME COLORS ---
const Colors = {
  light: {
    background: '#F1F5F9',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    accent: '#6366f1',
    border: '#e2e8f0',
    iconBg: '#f1f5f9',
    graphicTint: 'rgba(99, 102, 241, 0.05)', 
  },
  dark: {
    background: '#0f172a', 
    cardBg: '#1e293b',     
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    accent: '#818cf8',
    border: '#334155',
    iconBg: '#334155',
    graphicTint: 'rgba(255, 255, 255, 0.05)', 
  }
};

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [selectedJobIndex, setSelectedJobIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const spin = useSharedValue(0);
  const GRAPHIC_URL = "https://www.transparenttextures.com/patterns/cubes.png";

  useFocusEffect(
    useCallback(() => {
      getProfile();
    }, [])
  );

  const getProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setSelectedJobIndex(0);
      }
    } catch (e) { console.log(e); } finally { setRefreshing(false); }
  };

  const jobs = profile?.jobs || [];
  const hasMultipleJobs = jobs.length > 1;
  
  const rawJob = jobs.length > 0 ? jobs[selectedJobIndex] : null;
  
  const currentJob = rawJob ? {
        title: rawJob.job_title || 'No Title',
        company: rawJob.company_name || 'No Company',
        department: rawJob.department || 'No Department',
        rate: rawJob.salary ? rawJob.salary.toString() : '0',
        cutoff: rawJob.cutoff_config || '',
        shift: rawJob.work_schedule ? `${rawJob.work_schedule.start} - ${rawJob.work_schedule.end}` : null 
  } : {
        title: profile?.job_title || '', 
        company: profile?.company_name || '',
        department: profile?.department || 'No Department',
        rate: profile?.salary ? profile.salary.toString() : '0',
        cutoff: profile?.cutoff_config || '',
        shift: profile?.work_schedule ? `${profile.work_schedule.start} - ${profile.work_schedule.end}` : null 
  };

  const isJobEmpty = !currentJob.company && !currentJob.title;

  const displayName = profile 
    ? `${profile.title ? profile.title + ' ' : ''}${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name 
    : 'Loading...';

  const handleSwitchJob = () => {
    if (!hasMultipleJobs) return;
    setSelectedJobIndex((prev) => (prev + 1) % jobs.length);
  };

  const handleEditProfile = () => {
    router.push({
      pathname: '/edit-profile',
      params: { mode: 'edit' } 
    });
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    spin.value = withTiming(spin.value === 0 ? 1 : 0, {
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
    });
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(spin.value, [0, 1], [0, 180]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      zIndex: spin.value === 0 ? 1 : 0,
      opacity: interpolate(spin.value, [0, 0.5, 1], [1, 0, 0]),
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(spin.value, [0, 1], [180, 360]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      zIndex: spin.value === 1 ? 1 : 0,
      opacity: interpolate(spin.value, [0, 0.5, 1], [0, 0, 1]),
    };
  });

  const getCutoffLabel = (val: string) => {
      switch(val) {
          case '15-30': return '15th / 30th';
          case 'weekly-fri': return 'Weekly';
          case 'monthly': return 'Monthly';
          default: return val || 'Not Set';
      }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Profile</Text>
        <TouchableOpacity 
          onPress={() => router.push('/settings')} 
          style={[styles.settingsBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
        >
          <HugeiconsIcon icon={Settings02Icon} size={24} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); getProfile(); }} tintColor={theme.accent} />}
      >
        
        {/* --- CARD CONTAINER --- */}
        <View style={styles.cardContainer}>
            
            {/* FRONT FACE */}
            <Animated.View style={[
                styles.cardFace, 
                styles.frontFace, 
                frontAnimatedStyle,
                { backgroundColor: theme.cardBg, borderColor: theme.border }
            ]}>
                <Image 
                    source={{ uri: GRAPHIC_URL }} 
                    style={[StyleSheet.absoluteFillObject, { opacity: 0.6, tintColor: theme.graphicTint }]}
                    resizeMode="repeat"
                />

                {/* Removed Pro Glass Button */}

                <TouchableOpacity onPress={handleEditProfile} style={[styles.editIconBtn, { backgroundColor: isDark ? '#312e81' : '#eef2ff' }]}>
                    <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.accent} />
                </TouchableOpacity>

                <View style={styles.centeredContent}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.iconBg, borderColor: theme.cardBg }]}>
                        {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatar} resizeMode="cover" />
                        ) : (
                        <HugeiconsIcon icon={UserCircleIcon} size={64} color={theme.textSecondary} />
                        )}
                    </View>
                    <Text style={[styles.nameText, { color: theme.textPrimary }]}>{displayName}</Text>
                    {currentJob.title ? (
                        <Text style={[styles.jobText, { color: theme.accent }]}>{currentJob.title}</Text>
                    ) : (
                        <Text style={[styles.jobText, { color: theme.textSecondary, opacity: 0.5 }]}>No Job Title</Text>
                    )}
                </View>
            </Animated.View>

            {/* BACK FACE */}
            <Animated.View style={[
                styles.cardFace, 
                styles.backFace, 
                backAnimatedStyle,
                { backgroundColor: theme.cardBg, borderColor: theme.border }
            ]}>
                <Image 
                    source={{ uri: GRAPHIC_URL }} 
                    style={[StyleSheet.absoluteFillObject, { opacity: 0.6, tintColor: theme.graphicTint }]}
                    resizeMode="repeat"
                />

                {hasMultipleJobs && (
                  <TouchableOpacity onPress={handleSwitchJob} style={[styles.switchJobBtn, { backgroundColor: isDark ? '#312e81' : '#eef2ff' }]}>
                      <Text style={[styles.switchJobText, { color: theme.accent }]}>Switch Job</Text>
                      <HugeiconsIcon icon={RepeatIcon} size={16} color={theme.accent} />
                  </TouchableOpacity>
                )}

                <View style={styles.centeredContent}>
                    {/* EMPTY STATE LOGIC */}
                    {isJobEmpty ? (
                        <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', gap: 16 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                                <HugeiconsIcon icon={Briefcase01Icon} size={40} color={theme.textSecondary} />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textSecondary }}>No Job Details Found</Text>
                            
                            <TouchableOpacity 
                                onPress={handleEditProfile}
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, gap: 8, marginTop: 8 }}
                            >
                                <HugeiconsIcon icon={PlusSignIcon} size={18} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Update Profile</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={styles.backHeaderContainer}>
                                <Text style={[styles.companyHeader, { color: theme.textPrimary }]}>{currentJob.company}</Text>
                                <Text 
                                    style={[styles.departmentHeader, { color: theme.textSecondary }]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit={true}
                                    minimumFontScale={0.7}
                                >
                                    {currentJob.department}
                                </Text>
                            </View>
                            
                            <Divider theme={theme} />

                            <View style={styles.detailsContainer}>
                                <DetailRow icon={Money03Icon} label="Rate" value={`₱ ${currentJob.rate}`} theme={theme} />
                                <Divider theme={theme} />
                                <DetailRow icon={Calendar03Icon} label="Cutoff" value={getCutoffLabel(currentJob.cutoff)} theme={theme} />
                                <Divider theme={theme} />
                                {currentJob.shift && (
                                    <DetailRow icon={Clock01Icon} label="Shift" value={currentJob.shift} theme={theme} />
                                )}
                                <DetailRow icon={Briefcase01Icon} label="Status" value="Active" theme={theme} />
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>
        </View>

        {/* --- EXTERNAL BUTTON --- */}
        <TouchableOpacity 
            style={[styles.externalFlipBtn, { backgroundColor: theme.textPrimary, shadowColor: theme.textPrimary }]} 
            onPress={handleFlip}
            activeOpacity={0.8}
        >
            <HugeiconsIcon icon={ArrowLeftRightIcon} size={20} color={theme.cardBg} />
            <Text style={[styles.externalFlipBtnText, { color: theme.cardBg }]}>
                {isFlipped ? "View Personal Info" : "View Job Details"}
            </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTS ---
const Divider = ({ theme }: any) => <View style={[styles.divider, { backgroundColor: theme.border }]} />;

function DetailRow({ icon: Icon, label, value, theme }: any) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <View style={[styles.iconCircle, { backgroundColor: theme.iconBg }]}>
           <HugeiconsIcon icon={Icon} size={16} color={theme.textSecondary} />
        </View>
        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    headerTitle: { fontSize: 28, fontWeight: '800' },
    settingsBtn: {
        padding: 12, borderRadius: 999, borderWidth: 1,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2,
    },
    scrollContainer: {
        flexGrow: 1, 
        justifyContent: 'flex-start', 
        alignItems: 'center', 
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 120 
    },
    
    cardContainer: { width: '100%', height: 440, position: 'relative', marginBottom: 30 },
    
    cardFace: {
        width: '100%', height: '100%', borderRadius: 32, padding: 24,
        position: 'absolute', backfaceVisibility: 'hidden', shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5,
        borderWidth: 1,
        overflow: 'hidden'
    },
    frontFace: { zIndex: 2 },
    backFace: { zIndex: 1, transform: [{ rotateY: '180deg' }] },
    
    centeredContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        zIndex: 10,
    },

    externalFlipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 20,
        gap: 12,
        width: '100%',
        maxWidth: 300,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    externalFlipBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
    },

    editIconBtn: {
        position: 'absolute', top: 20, right: 20, padding: 10,
        borderRadius: 12, zIndex: 20,
    },
    
    avatarContainer: {
        width: 120, height: 120, borderRadius: 60, borderWidth: 4,
        justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden',
        shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10,
    },
    avatar: { width: '100%', height: '100%' },
    nameText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
    jobText: { fontSize: 16, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 12 },

    switchJobBtn: {
        position: 'absolute', top: 20, right: 20,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, zIndex: 20
    },
    switchJobText: { fontSize: 12, fontWeight: '700' },

    backHeaderContainer: { alignItems: 'center', marginBottom: 20, width: '100%' },
    
    companyHeader: { 
        fontSize: 18,
        fontWeight: '800', 
        textAlign: 'center', 
        marginBottom: 4 
    },
    departmentHeader: { 
        fontSize: 14,
        fontWeight: '600', 
        textAlign: 'center', 
        textTransform: 'uppercase', 
        letterSpacing: 1,
        width: '90%'
    },

    detailsContainer: { width: '100%', gap: 8, marginTop: 10 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    detailLabel: { fontSize: 14, fontWeight: 'bold' },
    detailValue: { fontSize: 15, fontWeight: 'bold' },
    divider: { height: 1, width: '100%', marginVertical: 5 },
});