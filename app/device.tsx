import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  Select,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectBackdrop as SelectModalBackdrop,
  SelectContent as SelectModalContent,
  SelectPortal,
  SelectTrigger,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Connection, connectionManager } from "@/lib/blufi/connection";
import { OpMode } from "@/lib/blufi/frame";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

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
  const [wifiList, setWifiList] = useState<{ ssid: string; rssi: number }[]>(
    [],
  );
  const [loadingWifiList, setLoadingWifiList] = useState(false);
  const [selectedOpMode, setSelectedOpMode] = useState<OpMode | null>(null);

  const getConnection = useCallback(() => {
    return connectionManager.getConnection(deviceId);
  }, [deviceId]);

  const connect = async () => {
    //todo  set -1 to use default for test,remove for production
    const connection = await connectionManager.connect(deviceId, {
      requestMtu: -1,
      ackTimeout: 2000,
    });
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
        setWifiList(data);
        setLoadingWifiList(false);
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

  const setStationMode = async (opMode: OpMode) => {
    try {
      await connection?.sendSetOpModeCtrlFrame(opMode);
      setReceivedMessages((prev) => [
        ...prev,
        `发送: 设置模式为 ${OpMode[opMode] || opMode}`,
      ]);
    } catch (error) {
      console.error(`设置模式 ${OpMode[opMode] || opMode} 失败:`, error);
      alert(`设置模式失败: ${(error as Error).message}`);
    }
  };

  const handleModeChange = (value: string) => {
    const mode = parseInt(value, 10) as OpMode;
    if (!isNaN(mode) && OpMode[mode] !== undefined) {
      setSelectedOpMode(mode);
      setStationMode(mode);
    } else {
      console.warn("Invalid OpMode selected:", value);
    }
  };

  const handleOpenConfigModal = async () => {
    setWifiList([]);
    setSsid("");
    setPassword("");
    setLoadingWifiList(true);
    setShowConfigModal(true);
    try {
      if (!connection || !(await connection.isConnected())) {
        alert("请先连接设备");
        setShowConfigModal(false);
        setLoadingWifiList(false);
        return;
      }
      await connection?.sendGetWifiListCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 获取Wi-Fi列表`]);
    } catch (error) {
      console.error("发送获取Wi-Fi列表命令失败:", error);
      alert("获取Wi-Fi列表失败: " + (error as Error).message);
      setShowConfigModal(false);
      setLoadingWifiList(false);
    }
  };

  const handleConfigWifi = async () => {
    try {
      if (!ssid) {
        alert("请先选择一个WiFi网络");
        return;
      }
      await connection?.sendStaWifiSsidDataFrame(ssid);
      await connection?.sendStaWifiPasswordDataFrame(password);
      setReceivedMessages((prev) => [
        ...prev,
        `发送: 配置WiFi - SSID: ${ssid},pwd:${password}`,
      ]);
      setShowConfigModal(false);
      setSsid("");
      setPassword("");
      setWifiList([]);
      setLoadingWifiList(false);
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

  const handleDisconnectWifi = async () => {
    try {
      await connection?.sendDisconnectWifiCtrlFrame();
      setReceivedMessages((prev) => [...prev, `发送: 断开WiFi连接`]);
    } catch (error) {
      console.error("断开WiFi连接失败:", error);
      alert("断开WiFi连接失败: " + (error as Error).message);
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
        <ScrollView
          className="mb-4 flex-1"
          style={styles.messageList}
          contentContainerStyle={{ paddingBottom: 10 }} // Optional padding for the bottom
        >
          {receivedMessages.map((msg, index) => (
            <Text key={index} className="mb-1 text-sm">
              {msg}
            </Text>
          ))}
        </ScrollView>

        {/* 发送消息区域 */}
        <View style={styles.inputContainer}>
          <View style={styles.buttonRow}>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-primary-500" : "bg-gray-400"}`}
              onPress={getVersion}
              disabled={!isConnected}
            >
              <ButtonText>版本</ButtonText>
            </Button>
            <Select
              onValueChange={handleModeChange}
              isDisabled={!isConnected}
              className="mr-2 flex-1"
            >
              <SelectTrigger
                size="md"
                disabled={!isConnected}
                className={`${isConnected ? "bg-primary-500" : "bg-gray-400"} h-10 flex-1 items-center justify-center rounded-md border-0`}
              >
                <SelectInput
                  placeholder="模式"
                  className="m-0 p-0 text-center leading-none text-white"
                  style={{ lineHeight: undefined }}
                />
              </SelectTrigger>
              <SelectPortal>
                <SelectModalBackdrop />
                <SelectModalContent>
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>
                  <SelectItem
                    label="Station Mode"
                    value={String(OpMode.STATION)}
                  />
                  <SelectItem
                    label="SoftAP Mode"
                    value={String(OpMode.SOFTAP)}
                  />
                  <SelectItem
                    label="Station + SoftAP"
                    value={String(OpMode.STATION_SOFTAP)}
                  />
                </SelectModalContent>
              </SelectPortal>
            </Select>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-primary-500" : "bg-gray-400"}`}
              onPress={handleOpenConfigModal}
              disabled={!isConnected}
            >
              <ButtonText>配网</ButtonText>
            </Button>
          </View>
          <View style={styles.buttonRow}>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-primary-500" : "bg-gray-400"}`}
              onPress={handleConnectWifi}
              disabled={!isConnected}
            >
              <ButtonText>联网</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-primary-500" : "bg-gray-400"}`}
              onPress={getWifiStatus}
              disabled={!isConnected}
            >
              <ButtonText>状态</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`mr-2 flex-1 ${isConnected ? "bg-primary-500" : "bg-gray-400"}`}
              onPress={() => setShowCustomDataModal(true)}
              disabled={!isConnected}
            >
              <ButtonText>数据</ButtonText>
            </Button>
            <Button
              variant="solid"
              className={`flex-1 ${isConnected ? "bg-primary-500" : "bg-gray-400"}`}
              onPress={handleDisconnectWifi}
              disabled={!isConnected}
            >
              <ButtonText>断网</ButtonText>
            </Button>
          </View>
        </View>
      </Box>

      {/* 配网对话框 */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setWifiList([]);
          setLoadingWifiList(false);
        }}
      >
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Text className="text-lg font-bold">配置WiFi</Text>
          </ModalHeader>
          <ModalBody>
            {loadingWifiList ? (
              <Box className="mb-4 h-10 items-center justify-center">
                <Spinner size="small" />
              </Box>
            ) : (
              <Select
                selectedValue={ssid}
                onValueChange={setSsid}
                isDisabled={wifiList.length === 0}
                className="mb-4"
              >
                <SelectTrigger variant="outline" size="md">
                  <SelectInput
                    placeholder={
                      wifiList.length === 0 ? "未扫描到WiFi" : "选择WiFi网络..."
                    }
                  />
                  <View style={{ marginRight: 12 }}>
                    <SelectIcon as={ChevronDownIcon} />
                  </View>
                </SelectTrigger>
                <SelectPortal>
                  <SelectModalBackdrop />
                  <SelectModalContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {(() => {
                      // Filter unique SSIDs before mapping
                      const uniqueWifiMap = new Map<
                        string,
                        { ssid: string; rssi: number }
                      >();
                      wifiList.forEach((wifi) => {
                        // If SSID not seen before, or if current RSSI is stronger than stored one
                        if (
                          !uniqueWifiMap.has(wifi.ssid) ||
                          wifi.rssi >
                            (uniqueWifiMap.get(wifi.ssid)?.rssi ?? -Infinity)
                        ) {
                          uniqueWifiMap.set(wifi.ssid, wifi);
                        }
                      });
                      const uniqueWifiList = Array.from(uniqueWifiMap.values());

                      if (uniqueWifiList.length > 0) {
                        return uniqueWifiList.map((wifi) => (
                          <SelectItem
                            key={wifi.ssid}
                            label={`${wifi.ssid} (RSSI: ${wifi.rssi})`}
                            value={wifi.ssid}
                          />
                        ));
                      } else {
                        return (
                          <SelectItem
                            label="未扫描到WiFi或列表为空"
                            value=""
                            isDisabled={true}
                          />
                        );
                      }
                    })()}
                  </SelectModalContent>
                </SelectPortal>
              </Select>
            )}
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
              onPress={() => {
                setShowConfigModal(false);
                setWifiList([]);
                setLoadingWifiList(false);
              }}
            >
              <ButtonText>取消</ButtonText>
            </Button>
            <Button
              variant="solid"
              className="bg-blue-500"
              onPress={handleConfigWifi}
              disabled={!ssid}
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
    alignItems: "stretch",
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
