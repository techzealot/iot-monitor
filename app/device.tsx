import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { Connection, connectionManager } from "@/lib/blufi/connection";
import { Buffer } from "@craftzdog/react-native-buffer";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

export default function DeviceScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  //todo: 需要使用全局状态保持会话历史
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCustomDataModal, setShowCustomDataModal] = useState(false);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [customData, setCustomData] = useState("");

  const getConnection = useCallback(() => {
    return connectionManager.getConnection(deviceId);
  }, [deviceId]);

  const connect = async () => {
    const connection = await connectionManager.connect(deviceId);
    connection
      .onReceiveVersion((data) => {
        setReceivedMessages((prev) => [
          ...prev,
          `收到版本: ${data.greatVersion}.${data.subVersion}`,
        ]);
      })
      .onReceiveCustomData((data) => {
        setReceivedMessages((prev) => [
          ...prev,
          `收到自定义数据: ${data.data.toString("utf8")}`,
        ]);
      })
      .onReceiveWifiList((data) => {
        setReceivedMessages((prev) => [
          ...prev,
          `收到Wi-Fi列表: ${JSON.stringify(data)}`,
        ]);
      })
      .onReceiveWifiConnectionState((data) => {
        setReceivedMessages((prev) => [
          ...prev,
          `收到WiFi状态: ${JSON.stringify(data)}`,
        ]);
      })
      .onReceiveError((data) => {
        setReceivedMessages((prev) => [
          ...prev,
          `收到错误: ${JSON.stringify(data)}`,
        ]);
      });
    setConnection(connection);
    setIsConnected(true);
    return connection;
  };

  const disconnect = async () => {
    await connectionManager.disconnect(deviceId);
    setConnection(null);
    setIsConnected(false);
  };

  // 更新连接状态
  useEffect(() => {
    const updateConnectionStatus = async () => {
      const currentConnection = getConnection();
      if (currentConnection) {
        const connected = await currentConnection.isConnected();
        if (connected !== isConnected) {
          setIsConnected(connected);
          setConnection(currentConnection);
        }
      } else {
        setIsConnected(false);
        setConnection(null);
      }
    };

    // 立即更新一次
    updateConnectionStatus();

    // 设置定时器，每3秒更新一次
    const interval = setInterval(updateConnectionStatus, 3000);

    // 清理定时器
    return () => clearInterval(interval);
  }, [deviceId, isConnected, getConnection]);

  // 加载设备
  useEffect(() => {
    const loadDevice = async () => {
      try {
        //此处不能使用isConnected，因为isConnected是异步的，会导致连接状态不一致
        if (!getConnection()?.isConnected()) {
          console.log("设备未处于连接状态，尝试创建新的连接...");
          try {
            await connect();
          } catch (connectError) {
            alert("连接设备失败: " + (connectError as Error).message);
            router.back();
            return;
          }
        } else {
          // 如果已连接，获取现有连接
          const existingConnection = connectionManager.getConnection(deviceId);
          if (existingConnection) {
            setConnection(existingConnection);
            setIsConnected(true);
          }
        }
      } catch (error) {
        console.error("加载设备失败:", error);
        router.back();
      }
    };
    loadDevice();
  }, [deviceId, connection]);

  // 断开连接
  const disconnectDevice = async () => {
    try {
      if (connection) {
        await disconnect();
        setReceivedMessages([]);
        console.log("成功", "设备已断开连接");
        // router.back();
      }
    } catch (error) {
      console.error("断开连接失败:", error);
      Alert.alert("错误", "断开连接失败");
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // TODO: 处理下重连逻辑
  // 连接设备
  const connectDevice = async () => {
    try {
      console.log("尝试创建新的连接...");
      await connect();
    } catch (connectError) {
      alert("连接设备失败: " + (connectError as Error).message);
      router.back();
    }
  };

  const getVersion = async () => {
    try {
      await connection?.sendGetVersionCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 获取版本`]);
    } catch (error) {
      console.error("发送消息失败:", error);
      alert("发送失败: " + (error as Error).message);
    }
  };

  const getWifiList = async () => {
    try {
      await connection?.sendGetWifiListCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 获取Wi-Fi列表`]);
    } catch (error) {
      console.error("发送消息失败:", error);
      alert("发送失败: " + (error as Error).message);
    }
  };

  const disconnectBle = async () => {
    try {
      await connection?.sendDisconnectCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 断开连接`]);
    } catch (error) {
      console.error("断开连接失败:", error);
      alert("断开连接失败: " + (error as Error).message);
    }
  };

  const setStationMode = async () => {
    try {
      await connection?.sendSetOpModeCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 设置station`]);
    } catch (error) {
      console.error("设置station失败:", error);
      alert("设置station失败: " + (error as Error).message);
    }
  };

  const handleConfigWifi = async () => {
    try {
      //仅配置ssid和pwd，联网动作在handleConnectWifi中
      await connection?.sendStaWifiSsidDataFrame(ssid);
      await connection?.sendStaWifiPasswordDataFrame(password);
      setReceivedMessages((prev) => [
        ...prev,
        `发送: 配置WiFi - SSID: ${ssid},pwd:${password}`,
      ]);
      setShowConfigModal(false);
      setSsid("");
      setPassword("");
    } catch (error) {
      console.error("配置WiFi失败:", error);
      alert("配置WiFi失败: " + (error as Error).message);
    }
  };

  const handleConnectWifi = async () => {
    try {
      await connection?.sendConnectWifiCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 连接WiFi`]);
    } catch (error) {
      console.error("连接WiFi失败:", error);
      alert("连接WiFi失败: " + (error as Error).message);
    }
  };

  const getWifiStatus = async () => {
    try {
      await connection?.sendGetWifiStatusCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 获取WiFi状态`]);
    } catch (error) {
      console.error("获取WiFi状态失败:", error);
      alert("获取WiFi状态失败: " + (error as Error).message);
    }
  };

  const handleSendCustomData = async () => {
    try {
      const buffer = Buffer.from(customData, "utf8");
      await connection?.sendCustomDataDataFrame(buffer);
      setReceivedMessages((prev) => [...prev, `发送自定义数据: ${customData}`]);
      setShowCustomDataModal(false);
      setCustomData("");
    } catch (error) {
      console.error("发送自定义数据失败:", error);
      alert("发送自定义数据失败: " + (error as Error).message);
    }
  };

  return (
    <Box className="flex-1">
      <Stack.Screen
        options={{
          title: "设备",
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
              className="hidden border-red-500"
              onPress={isConnected ? disconnectDevice : connectDevice}
            >
              <ButtonText className="text-red-500">
                {isConnected ? "断开连接" : "连接"}
              </ButtonText>
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
          <View style={styles.buttonRow}>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={getVersion}
              disabled={!isConnected}
            >
              <ButtonText>版本</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={setStationMode}
              disabled={!isConnected}
            >
              <ButtonText>station</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={getWifiList}
              disabled={!isConnected}
            >
              <ButtonText>扫描</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={() => setShowConfigModal(true)}
              disabled={!isConnected}
            >
              <ButtonText>配网</ButtonText>
            </Button>
          </View>
          <View style={styles.buttonRow}>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={handleConnectWifi}
              disabled={!isConnected}
            >
              <ButtonText>联网</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={getWifiStatus}
              disabled={!isConnected}
            >
              <ButtonText>状态</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={() => setShowCustomDataModal(true)}
              disabled={!isConnected}
            >
              <ButtonText>数据</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`flex-1 ${isConnected ? "bg-blue-500" : "bg-gray-400"}`}
              onPress={disconnectBle}
              disabled={!isConnected}
            >
              <ButtonText>断开</ButtonText>
            </Button>
          </View>
        </View>
      </Box>

      {/* 配网对话框 */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Text className="text-lg font-bold">配置WiFi</Text>
          </ModalHeader>
          <ModalBody>
            <Input className="mb-4">
              <InputField
                placeholder="WiFi名称"
                value={ssid}
                onChangeText={setSsid}
              />
            </Input>
            <Input>
              <InputField
                placeholder="WiFi密码"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </Input>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              className="mr-2"
              onPress={() => setShowConfigModal(false)}
            >
              <ButtonText>取消</ButtonText>
            </Button>
            <Button
              variant="solid"
              className="bg-blue-500"
              onPress={handleConfigWifi}
            >
              <ButtonText>确定</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 自定义数据对话框 */}
      <Modal
        isOpen={showCustomDataModal}
        onClose={() => setShowCustomDataModal(false)}
      >
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Text className="text-lg font-bold">发送自定义数据</Text>
          </ModalHeader>
          <ModalBody>
            <Input>
              <InputField
                placeholder="输入数据"
                value={customData}
                onChangeText={setCustomData}
              />
            </Input>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              className="mr-2"
              onPress={() => setShowCustomDataModal(false)}
            >
              <ButtonText>取消</ButtonText>
            </Button>
            <Button
              variant="solid"
              className="bg-blue-500"
              onPress={handleSendCustomData}
            >
              <ButtonText>确定</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
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
