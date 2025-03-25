import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { bleManager, bluetoothManager } from "@/lib/bluetooth/manager";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Device } from "react-native-ble-plx";

export default function DeviceScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);

  // 检查连接状态
  const checkConnection = async () => {
    if (!device) return;
    try {
      const isConnected = await device.isConnected();
      setIsConnected(isConnected);
    } catch (error) {
      console.error("检查连接状态失败:", error);
      setIsConnected(false);
    }
  };

  // 定期检查连接状态
  useEffect(() => {
    console.log("DeviceScreen mounted");
    // 首次加载
    if (device) {
      checkConnection();
    }

    // 每3秒刷新一次
    const interval = setInterval(() => {
      if (device) {
        checkConnection();
      }
    }, 3000);

    // 清理函数
    return () => {
      console.log("DeviceScreen unmounted");
      clearInterval(interval);
    };
  }, [device]);

  // 加载设备
  useEffect(() => {
    const loadDevice = async () => {
      try {
        const devices = await bluetoothManager.getConnectedDevices();
        let device = devices.find((d: Device) => d.id === deviceId);

        if (!device) {
          console.log("设备未连接，尝试重新连接...");
          try {
            device = await bleManager.connectToDevice(deviceId);
            console.log("成功连接到设备:", device.name);
          } catch (connectError) {
            alert("连接设备失败: " + (connectError as Error).message);
            router.back();
            return;
          }
        }

        if (device) {
          // 设置设备
          setDevice(device);
          await bluetoothManager.retrieveAllServicesAndCharacteristics(device);
          //设置通知监听,接收20字节内的数据
          await bluetoothManager.onMessageNotify(device, (message) => {
            setReceivedMessages((prev) => [...prev, `接收: ${message}`]);
          });
        } else {
          console.log("未找到设备");
          router.back();
        }
      } catch (error) {
        console.error("加载设备失败:", error);
        router.back();
      }
    };

    loadDevice();
  }, [deviceId]);

  // 断开连接
  const disconnectDevice = async () => {
    try {
      if (device) {
        // 取消订阅
        //bluetoothManager.cancelSubscriptions(device.id);
        // 断开连接
        await device.cancelConnection();
        setDevice(null);
        setReceivedMessages([]);
        console.log("成功", "设备已断开连接");
      }
    } catch (error) {
      console.error("断开连接失败:", error);
      Alert.alert("错误", "断开连接失败");
    }
  };

  const sendMessage = async () => {
    if (!device || !message.trim()) return;

    try {
      await bluetoothManager.sendMessage(device, message);
      // 更新消息历史
      setReceivedMessages((prev) => [...prev, `发送: ${message}`]);
      // 清空输入
      setMessage("");
    } catch (error) {
      console.error("发送消息失败:", error);
      alert("发送失败: " + (error as Error).message);
    }
  };

  return (
    <Box className="flex-1">
      <Stack.Screen
        options={{
          title: device?.name || "设备",
          headerLeft: () => (
            <Ionicons
              name="chevron-back"
              size={24}
              color="#000"
              onPress={() => router.back()}
            />
          ),
          headerRight: () => (
            <Button
              variant="outline"
              className="border-red-500"
              onPress={disconnectDevice}
            >
              <ButtonText className="text-red-500">断开连接</ButtonText>
            </Button>
          ),
        }}
      />

      <Box className="flex-1 p-4">
        <Text className="mb-4 text-lg">
          连接状态: {isConnected ? "已连接" : "未连接"}
        </Text>

        {/* 消息列表 */}
        <Box className="mb-4 flex-1" style={styles.messageList}>
          {receivedMessages.map((msg, index) => (
            <Text key={index} className="mb-1 text-sm">
              {msg}
            </Text>
          ))}
        </Box>

        {/* 发送消息区域 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="输入消息..."
            placeholderTextColor="#999"
          />
          <Button
            variant="solid"
            className="ml-2 bg-blue-500"
            onPress={sendMessage}
          >
            <ButtonText>发送</ButtonText>
          </Button>
        </View>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  messageList: {
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    paddingHorizontal: 8,
    backgroundColor: "white",
  },
});
