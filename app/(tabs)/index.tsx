import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { connectionManager } from "@/lib/blufi/connection";
// requestPermissions is no longer directly used here
// import { requestPermissions } from "@/lib/blufi/permissions";
import { router } from "expo-router";
// BleManager and State are no longer directly used here
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { Device } from "react-native-ble-plx"; // Keep Device import if used elsewhere

// Remove local BleManager instance
// const bleManager = new BleManager();

// 获取设备类型
const getDeviceType = (name: string | null): string => {
  if (!name) return "其他设备";
  name = name.toLowerCase();

  if (
    name.includes("headphone") ||
    name.includes("earbud") ||
    name.includes("airpods") ||
    name.includes("耳机")
  ) {
    return "音频设备";
  }

  if (
    name.includes("watch") ||
    name.includes("band") ||
    name.includes("手表") ||
    name.includes("手环")
  ) {
    return "可穿戴设备";
  }

  return "其他设备";
};

export default function TabOneScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const scanTimeoutRef = useRef<number | null>(null); // Ref to store timeout ID (number in RN)

  // 开始扫描
  const startScan = useCallback(async () => {
    // Clear any existing timeout when starting a new scan or stopping
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    try {
      if (isScanning) {
        // 如果正在扫描，则停止扫描
        console.log("停止扫描...");
        connectionManager.stopDeviceScan();
        setIsScanning(false);
        // No need to clear timeout here again, it's cleared at the beginning
        return;
      }

      // 1. 请求权限 (via ConnectionManager)
      console.log("请求权限...");
      const permissionsGranted = await connectionManager.requestPermissions();
      if (!permissionsGranted) {
        console.warn("权限被拒绝");
        Alert.alert(
          "权限不足",
          "需要蓝牙和位置权限才能扫描设备。请在系统设置中授权。",
        );
        return;
      }
      console.log("权限已授予。");

      // 2. 检查蓝牙状态 (via ConnectionManager)
      console.log("检查蓝牙状态...");
      const bluetoothInfo = await connectionManager.checkBluetoothState();
      if (!bluetoothInfo.enabled) {
        Alert.alert(
          "蓝牙未开启",
          `请先开启蓝牙才能扫描设备 (当前状态: ${bluetoothInfo.state})`,
        );
        return;
      }
      console.log("蓝牙已开启。");

      // 移除：在扫描前断开所有连接可能不是期望行为
      // console.log('断开所有旧连接...');
      // connectionManager.disconnectAll();

      // 清空上次扫描结果
      setDevices([]);
      console.log("开始扫描...");
      setIsScanning(true); // Set scanning to true *before* starting the scan

      // 3. 开始扫描
      await connectionManager.startDeviceScan(
        null, // 扫描所有设备，或指定 UUID [Bluetooth.SERVICE_UUID]
        { allowDuplicates: false }, // 可选扫描选项
        (error, device) => {
          if (error) {
            console.error("扫描错误:", error);
            // 处理常见错误
            if (error.message.includes("Location services are disabled")) {
              Alert.alert(
                "定位服务未开启",
                "请开启设备的位置服务以扫描蓝牙设备。",
              );
            } else if (error.reason?.includes("is not authorized")) {
              // iOS 权限错误示例
              Alert.alert("权限错误", "请检查应用的蓝牙权限设置。");
            }
            setIsScanning(false); // Stop scanning on error
            if (scanTimeoutRef.current) {
              // Clear timeout on error too
              clearTimeout(scanTimeoutRef.current);
              scanTimeoutRef.current = null;
            }
            return;
          }

          if (device && device.name) {
            // 只添加有名字的设备
            setDevices((prev) => {
              // 使用 Map 来高效处理更新和避免重复渲染
              const devicesMap = new Map(prev.map((d) => [d.id, d]));
              devicesMap.set(device.id, device);
              return Array.from(devicesMap.values());
            });
          }
        },
      );

      // 10秒后自动停止扫描
      // Store the timeout ID in the ref
      scanTimeoutRef.current = setTimeout(() => {
        console.log("扫描超时，停止扫描。");
        connectionManager.stopDeviceScan();
        setIsScanning(false); // Directly set state to false
        scanTimeoutRef.current = null; // Clear the ref after timeout fires
      }, 10000) as unknown as number; // Explicitly cast to number for RN environment
    } catch (error) {
      console.error("启动扫描失败:", error);
      setIsScanning(false);
      if (scanTimeoutRef.current) {
        // Clear timeout on catch error
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      Alert.alert("扫描启动失败", (error as Error).message);
    }
  }, [isScanning]); // Keep isScanning in dependency array

  // 连接设备
  const connectDevice = async (device: Device) => {
    // Stop scanning before connecting
    if (isScanning) {
      console.log("连接设备前停止扫描...");
      connectionManager.stopDeviceScan();
      setIsScanning(false);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    }
    try {
      // 导航到设备页面
      router.push(`/device?deviceId=${device.id}`);
    } catch (error) {
      console.error("连接失败:", error);
      alert("连接设备失败");
    }
  };

  // 断开设备连接
  const disconnectDevice = async (device: Device) => {
    try {
      console.log("正在断开设备连接:", device.id);
      connectionManager.disconnect(device.id);
    } catch (error) {
      console.error("断开连接失败:", error);
      alert("断开连接失败");
    }
  };

  // 渲染设备列表项
  const renderItem = ({ item: device }: { item: Device }) => {
    // 移除 isConnected 逻辑，因为现在点击整个项来连接
    // const isConnected = connectedDeviceIds.includes(device.id);

    return (
      // 使用 TouchableOpacity 包裹，并添加 onPress 事件
      <TouchableOpacity
        onPress={() => connectDevice(device)}
        activeOpacity={0.7}
      >
        <Box
          className="mb-2 flex-row items-center justify-between rounded-lg bg-white p-4"
          style={styles.deviceItem}
        >
          <Box className="mr-4 flex-1">
            <Text className="text-lg font-bold">
              {device.name || "未知设备"} ({getDeviceType(device.name)})
            </Text>
            <Text className="text-sm text-gray-500">ID: {device.id}</Text>
            <Text className="text-sm text-gray-500">
              信号强度: {device.rssi || "未知"}
            </Text>
          </Box>
          {/* 移除右侧的条件渲染和按钮 */}
          {/*
          {isConnected ? (
            <Box className="justify-between">
              <Button ... >查看</Button>
              <Button ... >断开</Button>
            </Box>
          ) : (
            <Button ... >连接</Button>
          )}
          */}
        </Box>
      </TouchableOpacity>
    );
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 确保停止扫描
      connectionManager.stopDeviceScan();
      // 清除任何未完成的扫描超时计时器
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      // 重要：销毁共享的 BleManager 实例
      // 这通常在应用根组件或应用生命周期事件中处理更合适
      // bleManager.destroy();
    };
  }, []); // Empty dependency array means this runs only on mount and unmount

  return (
    <Box className="flex-1 bg-background-50">
      {/* 顶部操作栏 */}
      <Box className="flex-row items-center justify-end p-4">
        <Button
          variant="solid"
          className={isScanning ? "bg-gray-500" : "bg-primary-500"}
          onPress={startScan}
        >
          <ButtonText>{isScanning ? "停止扫描" : "开始扫描"}</ButtonText>
        </Button>
      </Box>

      {/* 设备列表 */}
      <FlatList
        data={devices}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
    </Box>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  deviceItem: {
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 0.8,
  },
});
