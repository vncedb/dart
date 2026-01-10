import { Tabs } from 'expo-router';
import React from 'react';
import CustomTabBar from '../../components/CustomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        lazy: false, // Ensures tabs are mounted immediately, fixing some context issues
      }}
    >
      <Tabs.Screen 
        name="home" 
        options={{ title: 'Home' }} 
      />
      <Tabs.Screen 
        name="reports" 
        options={{ title: 'Reports' }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ title: 'Profile' }} 
      />
    </Tabs>
  );
}