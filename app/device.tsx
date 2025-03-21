import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { bleManager, bluetoothManager } from "@/lib/bluetooth/manager";
import { Buffer } from "@craftzdog/react-native-buffer";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Characteristic, Device } from "react-native-ble-plx";

// 定义服务和特征 UUID
const SERVICE_UUID = "55535343-fe7d-4ae5-8fa9-9fafd205e455";
const NOTIFY_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
const WRITE_CHARACTERISTIC_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";

export default function DeviceScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);

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
        const serviceUUIDs = [
          "55535343-fe7d-4ae5-8fa9-9fafd205e455",
          "00112233-4455-6677-8899-aabbccddeeff",
        ];
        console.log("开始加载设备:", deviceId);
        const devices = await bleManager.connectedDevices(serviceUUIDs);
        let device = devices.find((d: Device) => d.id === deviceId);

        if (!device) {
          console.log("设备未连接，尝试重新连接...");
          try {
            device = await bleManager.connectToDevice(deviceId);
            console.log("成功连接到设备:", device.name);
          } catch (connectError) {
            console.error("连接失败:", connectError);
            alert("连接设备失败: " + (connectError as Error).message);
            router.back();
            return;
          }
        }

        if (device) {
          console.log("开始发现服务和特征...");
          // 发现所有服务和特征
          const discoveredDevice =
            await device.discoverAllServicesAndCharacteristics();
          console.log("服务和特征发现完成");

          // 获取所有服务和特征
          const services = await discoveredDevice.services();
          console.log("发现服务数量:", services.length);

          // 打印所有服务的 UUID
          for (const service of services) {
            console.log("服务 UUID:", service.uuid);
            const chars = await service.characteristics();
            console.log("服务", service.uuid, "的特征数量:", chars.length);
            // 打印该服务下所有特征的 UUID
            for (const char of chars) {
              console.log("特征 UUID:", char.uuid, "属性:", {
                isNotifiable: char.isNotifiable,
                isNotifying: char.isNotifying,
                isReadable: char.isReadable,
                isWritableWithResponse: char.isWritableWithResponse,
                isWritableWithoutResponse: char.isWritableWithoutResponse,
              });
            }
          }

          // 设置设备
          setDevice(discoveredDevice);

          // 设置通知监听
          const subscription = discoveredDevice.monitorCharacteristicForService(
            SERVICE_UUID,
            NOTIFY_CHARACTERISTIC_UUID,
            (error: Error | null, characteristic: Characteristic | null) => {
              if (error) {
                console.warn("Monitor error:", error);
                return;
              }
              if (characteristic?.value) {
                const decodedValue = Buffer.from(
                  characteristic.value,
                  "base64",
                ).toString("utf8");
                console.log("收到数据:", decodedValue);
                setReceivedMessages((prev) => [
                  ...prev,
                  `接收: ${decodedValue}`,
                ]);
              }
            },
          );
          bluetoothManager.addMonitorSubscription(deviceId, subscription);
          console.log("已设置通知监听");
        } else {
          console.log("未找到设备");
          alert("未找到设备");
          router.back();
        }
      } catch (error) {
        console.error("加载设备失败:", error);
        alert("加载设备失败: " + (error as Error).message);
        router.back();
      }
    };

    loadDevice();
  }, [deviceId]);

  // 断开连接
  const disconnectDevice = async () => {
    if (!device) {
      console.log("没有设备需要断开连接");
      return;
    }

    try {
      console.log("开始断开设备连接:", device.name);
      await device.cancelConnection();
      console.log("设备已断开连接");
      // 清理该设备的所有监听器
      bluetoothManager.removeDeviceMonitors(device.id);
      console.log("已清理设备监听器");
      setIsConnected(false);
      router.back();
    } catch (error) {
      console.error("断开连接失败:", error);
      alert("断开连接失败: " + (error as Error).message);
    }
  };

  const sendMessage = async () => {
    if (!device || !message.trim()) return;

    try {
      console.log("开始发送消息...");
      // 确保服务和特征已发现
      const discoveredDevice =
        await device.discoverAllServicesAndCharacteristics();
      console.log("服务和特征发现完成");

      // 发送数据
      const messageBuffer = Buffer.from(message);
      const base64Message = messageBuffer.toString("base64");
      await discoveredDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        WRITE_CHARACTERISTIC_UUID,
        base64Message,
      );
      console.log("消息发送成功");

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
