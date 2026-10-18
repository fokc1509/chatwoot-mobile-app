import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LigacoesScreen from '@/screens/ligacoes/LigacoesScreen';

export type LigacoesStackParamList = {
  LigacoesScreen: undefined;
};

const Stack = createNativeStackNavigator<LigacoesStackParamList>();

export const LigacoesStack = () => {
  return (
    <Stack.Navigator initialRouteName="LigacoesScreen">
      <Stack.Screen
        options={{ headerShown: false }}
        name="LigacoesScreen"
        component={LigacoesScreen}
      />
    </Stack.Navigator>
  );
};
