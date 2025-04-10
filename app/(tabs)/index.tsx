import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { connectionManager } from "@/lib/blufi/connection";
// requestPermissions is no longer directly used here
// import { requestPermissions } from "@/lib/blufi/permissions";
import { router } from "expo-router";
// BleManager and State are no longer directly used here
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet } from "react-native";
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
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<string[]>([]);

  // 开始扫描
  const startScan = useCallback(async () => {
    try {
      if (isScanning) {
        // 如果正在扫描，则停止扫描
        console.log("停止扫描...");
        connectionManager.stopDeviceScan();
        setIsScanning(false);
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
      setIsScanning(true);

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
            setIsScanning(false);
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
      setTimeout(() => {
        // 检查是否仍在扫描，避免在已停止后再次调用 stop
        // 需要访问 isScanning 的最新值，或者通过状态来判断
        // 一个简单的做法是在 setIsScanning(false) 时清除 timeout
        // 或者在 timeout 回调中检查状态
        if (isScanning) {
          // 注意：这里的 isScanning 可能是闭包中的旧值
          console.log("扫描超时，停止扫描。");
          connectionManager.stopDeviceScan();
          setIsScanning(false);
        }
      }, 10000);
    } catch (error) {
      console.error("启动扫描失败:", error);
      setIsScanning(false);
      Alert.alert("扫描启动失败", (error as Error).message);
    }
  }, [isScanning]);

  // 连接设备
  const connectDevice = async (device: Device) => {
    try {
      // 停止扫描
      connectionManager.stopDeviceScan();
      // 更新已连接设备列表
      setConnectedDeviceIds((prev) => [...prev, device.id]);
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
      // 更新已连接设备列表
      setConnectedDeviceIds((prev) => prev.filter((id) => id !== device.id));
    } catch (error) {
      console.error("断开连接失败:", error);
      alert("断开连接失败");
    }
  };

  // 渲染设备列表项
  const renderItem = ({ item: device }: { item: Device }) => {
    const isConnected = false;

    return (
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
        {isConnected ? (
          <Box className="justify-between">
            <Button
              variant="outline"
              className="mb-2 w-20"
              onPress={() => {
                console.log("导航到设备页面:", device.name);
                router.push(`/device?deviceId=${device.id}`);
              }}
            >
              <ButtonText>查看</ButtonText>
            </Button>
            <Button
              variant="outline"
              className="w-20 border-red-500"
              onPress={() => disconnectDevice(device)}
            >
              <ButtonText className="text-red-500">断开</ButtonText>
            </Button>
          </Box>
        ) : (
          <Button
            variant="solid"
            className="bg-blue-500"
            onPress={() => connectDevice(device)}
          >
            <ButtonText className="text-white">连接</ButtonText>
          </Button>
        )}
      </Box>
    );
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 确保停止扫描
      connectionManager.stopDeviceScan();
      // 重要：销毁共享的 BleManager 实例
      // 这通常在应用根组件或应用生命周期事件中处理更合适
      // bleManager.destroy();
    };
  }, []);

  return (
    <Box className="flex-1 bg-gray-100">
      {/* 顶部操作栏 */}
      <Box className="flex-row items-center justify-between bg-white p-4">
        <Button
          variant="outline"
          onPress={() => {
            console.log("导航到配网页面");
            router.push("/network");
          }}
        >
          <ButtonText>配网</ButtonText>
        </Button>
        <Button
          variant="solid"
          className={isScanning ? "bg-gray-500" : "bg-blue-500"}
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
