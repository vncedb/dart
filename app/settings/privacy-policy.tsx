import * as Linking from 'expo-linking';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';

export default function PrivacyPolicyScreen() {
  const Section = ({ title, content }: { title: string; content: string }) => (
    <View className="mb-6">
      <Text className="mb-2 text-lg font-bold text-slate-800 dark:text-white">{title}</Text>
      <Text className="leading-6 text-slate-600 dark:text-slate-400">{content}</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['top']}>
      <Header title="Privacy Policy" />

      <ScrollView className="flex-1 px-6 py-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mb-6 text-sm font-medium text-slate-400">Last Updated: {new Date().toLocaleDateString()}</Text>

        <Section title="1. Introduction" content="Welcome to DART (Daily Accomplishment Report Tool). We value your privacy and are committed to protecting your personal data." />
        <Section title="2. Information We Collect" content="We collect information that you provide directly to us, such as your name, job position, and reports." />
        <Section title="3. How We Use Your Data" content="Your data is used solely for the purpose of generating, storing, and organizing your daily reports." />
        
        <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-slate-800 dark:text-white">5. Contact Us</Text>
            <Text className="leading-6 text-slate-600 dark:text-slate-400">
                If you have any questions, please contact us at 
                <Text 
                    onPress={() => Linking.openURL('mailto:dart.vdb@gmail.com')} 
                    style={{ color: '#6366f1', fontWeight: 'bold' }}> dart.vdb@gmail.com
                </Text>.
            </Text>
        </View>
        
        <View className="items-center mt-8 mb-8">
            <Text className="text-xs text-slate-300">DART by Project Vdb</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}