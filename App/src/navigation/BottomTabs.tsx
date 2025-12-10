import React from 'react';
import { Text, View, TouchableOpacity, Alert, Image, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import AccountScreen from '../screens/AccountScreen';
import Ionicons from '@react-native-vector-icons/ionicons';

function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text>Thông báo</Text>
      </View>
    </View>
  );
}


const Tab = createBottomTabNavigator();

const TabBarIcon = ({ route, focused, color, size }: { route: any; focused: boolean; color: string; size?: number }) => {
  let iconName = 'home-outline';

  if (route.name === 'Home') {
    iconName = focused ? 'home' : 'home-outline';
  } else if (route.name === 'Notifications') {
    iconName = focused ? 'notifications' : 'notifications-outline';
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
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarLabel: 'Thông báo' }} />
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
