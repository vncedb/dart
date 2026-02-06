import { createMaterialTopTabNavigator, MaterialTopTabNavigationEventMap, MaterialTopTabNavigationOptions } from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { withLayoutContext } from 'expo-router';
import React from 'react';
import CustomTabBar from '../../components/CustomTabBar';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function TabsLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: false,
        animationEnabled: true,
        lazy: false,
      }}
    >
      <MaterialTopTabs.Screen 
        name="home" 
        options={{ title: 'Home' }} 
      />
      <MaterialTopTabs.Screen 
        name="reports" 
        options={{ title: 'Reports' }} 
      />
      <MaterialTopTabs.Screen 
        name="profile" 
        options={{ title: 'Profile' }} 
      />
    </MaterialTopTabs>
  );
}