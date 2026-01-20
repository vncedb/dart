import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // 1. Handle the callback
    const handleSession = async () => {
      // Check if we have tokens in the URL params (handled by Expo Router)
      // Note: Supabase fragments (#) might be parsed as params by Expo Router in some configs, 
      // but usually we check the session directly as the AuthSession flow might have set it.
      
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        router.replace('/(tabs)/home');
      } else {
        // If we landed here but strictly via deep link and no session yet:
        // Parse manual params if needed, but usually the Auth flow in auth.tsx handles the setSession.
        // We just redirect to home if ready, or back to auth if failed.
        
        // Give it a moment to sync
        setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
                router.replace('/(tabs)/home');
            } else {
                router.replace('/auth');
            }
        }, 1000);
      }
    };

    handleSession();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#4F46E5" />
      <Text style={{ marginTop: 20, color: '#666', fontWeight: '500' }}>Verifying login...</Text>
    </View>
  );
}