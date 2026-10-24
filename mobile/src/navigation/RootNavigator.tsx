import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList, RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TaskFormScreen from '../screens/TaskFormScreen';
import TaskDetailsScreen from '../screens/TaskDetailsScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AppStackScreen() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="TaskForm"
        component={TaskFormScreen}
        options={({ route }) => ({
          title: route.params?.taskId ? 'Edit Task' : 'New Task',
        })}
      />
      <AppStack.Screen
        name="TaskDetails"
        component={TaskDetailsScreen}
        options={{ title: 'Task Details' }}
      />
    </AppStack.Navigator>
  );
}

/** Switches between auth screens and the app based on AuthContext state. */
export default function RootNavigator({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return <AppStackScreen />;
  }
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Register" component={RegisterScreen} />
    </RootStack.Navigator>
  );
}
