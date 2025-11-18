import React from 'react';
import { Text, View, TouchableOpacity, Alert, Image, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import AccountScreen from '../screens/Account';
import AppointmentScheduleScreen from '../screens/Schedule';
import MedsScreen from '../screens/Meds';
import MessagesScreen from '../screens/Messages';
import Ionicons from '@react-native-vector-icons/ionicons';

// Replace Notifications tab with History (completed appointments)


const Tab = createBottomTabNavigator();

const TabBarIcon = ({ route, focused, color, size }: { route: any; focused: boolean; color: string; size?: number }) => {
  let iconName = 'home-outline';

  if (route.name === 'Home') {
    iconName = focused ? 'home' : 'home-outline';
  } else if (route.name === 'Appointments') {
    iconName = focused ? 'calendar' : 'calendar-outline';
  } else if (route.name === 'Meds') {
    iconName = focused ? 'medkit' : 'medkit-outline';
  } else if (route.name === 'Messages') {
    iconName = focused ? 'chatbubble' : 'chatbubble-outline';
  } else if (route.name === 'Account') {
    iconName = focused ? 'person' : 'person-outline';
  }

  return <Ionicons name={iconName as any} size={size ?? 22} color={color} />;
};

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarShowLabel: true,
        tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size?: number }) => (
          <TabBarIcon route={route} focused={focused} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={Home} options={{ tabBarLabel: 'Trang chủ' }} />
      <Tab.Screen name="Appointments" component={AppointmentScheduleScreen} options={{ tabBarLabel: 'Lịch hẹn' }} />
      <Tab.Screen name="Meds" component={MedsScreen} options={{ tabBarLabel: 'Đơn thuốc' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: 'Tin nhắn' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Tài khoản' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
