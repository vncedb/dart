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
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
        },
      }}
    >
      <Tabs.Screen 
        name="home" // Changed from 'index'
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