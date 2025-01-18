import { Icon } from "@/components/ui/icon";
import { Tabs } from "expo-router";
import { BellRing, Sun, UserCog } from "lucide-react-native";
import React from "react";
import { StyleSheet } from "react-native";

const TabsLayout = () => {
  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          padding: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "监控",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <Icon as={Sun} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "告警",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Icon as={BellRing} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: "个人中心",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Icon as={UserCog} color={color} />
          ),
        }}
      />
    </Tabs>
  );
};

const styles = StyleSheet.create({});

export default TabsLayout;
