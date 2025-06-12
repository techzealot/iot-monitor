import { Stack } from "expo-router";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { Buffer } from "@craftzdog/react-native-buffer";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * 采用全局设置后可以保障nodejs buffer相关方法可以在react-native中通用
 * 在浏览器里，全局对象是 window
 *在 Node.js/React Native 里，全局对象是 global
 *挂载到全局对象上的属性或函数，可以在整个项目的任意 JS 文件里直接访问，无需 import
 */
if (typeof global.Buffer === "undefined") {
  (global.Buffer as any) = Buffer;
}

export default function RootLayout() {
  return (
    <SafeAreaView className="h-full">
      <GluestackUIProvider mode="light">
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </GluestackUIProvider>
    </SafeAreaView>
  );
}
