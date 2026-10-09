import { Tabs } from 'expo-router/js-tabs';
import { AppTabBar } from '../../src/components/AppTabBar';
import { useLayout } from '../../src/hooks/useLayout';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const { isWide } = useLayout();
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} sidebar={isWide} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="library" options={{ title: 'Workouts' }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
