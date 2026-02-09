import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '💬',
    reminders: '⏰',
    settings: '⚙️',
  };
  return (
    <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '📱'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#16213e',
          borderTopColor: '#0f3460',
        },
        tabBarActiveTintColor: '#4285f4',
        tabBarInactiveTintColor: '#888',
        headerStyle: { backgroundColor: '#16213e' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 24 }}>🖖</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>SpockAI</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ focused }) => <TabIcon name="reminders" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
