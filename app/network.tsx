import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { bluetoothManager } from "@/lib/bluetooth/manager";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { Device } from "react-native-ble-plx";

interface Message {
  deviceId: string;
  deviceName: string;
  content: string;
  timestamp: number;
  isFromDevice: boolean;
}

export default function NetworkScreen() {
  const [connectedDevices, setConnectedDevices] = useState<Device[]>([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  // 加载已连接设备
  const loadConnectedDevices = async () => {
    try {
      const devices = await bluetoothManager.getConnectedDevices();

      if (devices.length > 0) {
        // 为每个设备设置通知监听
        for (const device of devices) {
          await setupDeviceNotification(device);
        }
      }
      setConnectedDevices(devices);
    } catch (error) {
      console.error("加载已连接设备失败:", error);
      setConnectedDevices([]);
    }
  };

  // 设置设备的通知监听
  const setupDeviceNotification = async (device: Device) => {
    return bluetoothManager.onMessageReceived(device, (message) => {
      setMessages((prev) => [
        ...prev,
        {
          deviceId: device.id,
          deviceName: device.name || "未知设备",
          content: message,
          timestamp: Date.now(),
          isFromDevice: true,
        },
      ]);
    });
  };

  useEffect(() => {
    console.log("NetworkScreen mounted");
    loadConnectedDevices();
    return () => {
      console.log("NetworkScreen unmounted");
      // 清理所有监听器和连接
      connectedDevices.forEach((device) => {
        device.cancelConnection(); // 断开连接时会自动清理监听器
      });
    };
  }, []);

  // 发送消息到所有设备
  const sendMessageToAll = async () => {
    if (!message.trim() || connectedDevices.length === 0) return;

    try {
      // 遍历所有已连接设备
      for (const device of connectedDevices) {
        await bluetoothManager.sendMessage(device, message);
        // 添加发送的消息到列表
        setMessages((prev) => [
          ...prev,
          {
            deviceId: device.id,
            deviceName: device.name || "未知设备",
            content: message,
            timestamp: Date.now(),
            isFromDevice: false,
          },
        ]);
        // 清空输入
        setMessage("");
      }
    } catch (error) {
      console.error("群发消息失败:", error);
      alert("发送失败: " + (error as Error).message);
    }
  };

  // 渲染设备列表项
  const renderDeviceItem = ({ item: device }: { item: Device }) => {
    return (
      <Box
        className="mr-2 items-center justify-center rounded bg-white px-3 py-2"
        style={styles.deviceItem}
        onTouchEnd={() => {
          console.log("导航到设备页面:", device.name);
          router.push(`/device?deviceId=${device.id}`);
        }}
      >
        <Text className="text-base">
          {device.name || "未知设备"} ({device.id.slice(0, 6)})
        </Text>
      </Box>
    );
  };

  // 渲染消息项
  const renderMessageItem = ({ item }: { item: Message }) => {
    const time = new Date(item.timestamp).toLocaleTimeString();
    return (
      <Box
        className={`mb-2 rounded-lg p-2 ${
          item.isFromDevice ? "bg-gray-100" : "bg-blue-100"
        }`}
      >
        <Box className="flex-row items-center justify-between">
          <Text className="text-xs text-gray-500">
            {item.isFromDevice ? "收到" : "发送"} - {item.deviceName}
          </Text>
          <Text className="text-xs text-gray-500">{time}</Text>
        </Box>
        <Text className="text-xs text-gray-500">
          ID: {item.deviceId.slice(0, 8)}...
        </Text>
        <Text className="mt-1">{item.content}</Text>
      </Box>
    );
  };

  return (
    <Box className="flex-1">
      <Stack.Screen
        options={{
          title: "配网",
          headerLeft: () => (
            <Ionicons
              name="chevron-back"
              size={24}
              color="#000"
              onPress={() => router.back()}
            />
          ),
        }}
      />

      <Box className="flex-1 p-4">
        {/* 已连接设备列表 */}
        <Box className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-bold">
            已连接设备 ({connectedDevices.length})
          </Text>
          <Text className="text-sm text-gray-500">左右滑动查看更多</Text>
        </Box>
        <Box className="mb-2" style={styles.deviceList}>
          <FlatList
            data={connectedDevices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={() => (
              <Text className="p-2 text-center text-gray-500">
                暂无已连接设备
              </Text>
            )}
          />
        </Box>

        {/* 消息列表 */}
        <Text className="mb-2 text-lg font-bold">消息记录</Text>
        <Box className="mb-4 flex-1" style={styles.messageList}>
          <FlatList
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => `${item.deviceId}-${item.timestamp}`}
            ListEmptyComponent={() => (
              <Text className="p-4 text-center text-gray-500">
                暂无消息记录
              </Text>
            )}
          />
        </Box>

        {/* 发送消息区域 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="输入要发送给所有设备的消息..."
            placeholderTextColor="#999"
          />
          <Button
            variant="solid"
            className="ml-2 bg-blue-500"
            onPress={sendMessageToAll}
          >
            <ButtonText>群发</ButtonText>
          </Button>
        </View>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  deviceList: {
    height: 44,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    backgroundColor: "white",
    padding: 2,
  },
  deviceItem: {
    minWidth: 140,
    backgroundColor: "white",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.12,
    shadowRadius: 1,
  },
  messageList: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    backgroundColor: "white",
    padding: 8,
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
