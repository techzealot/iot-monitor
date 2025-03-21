import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { bleManager } from "@/lib/bluetooth/manager";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import { Device } from "react-native-ble-plx";

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
      // 断开所有已连接设备
      const serviceUUIDs = [
        "55535343-fe7d-4ae5-8fa9-9fafd205e455",
        "00112233-4455-6677-8899-aabbccddeeff",
      ];
      const connectedDevices = await bleManager.connectedDevices(serviceUUIDs);
      for (const device of connectedDevices) {
        await device.cancelConnection();
      }

      // 开始扫描
      setIsScanning(true);
      setDevices([]);

      // 获取已连接设备
      const connected = await bleManager.connectedDevices([]);
      setConnectedDeviceIds(connected.map((d) => d.id));

      // 开始扫描
      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error("扫描错误:", error);
          setIsScanning(false);
          return;
        }

        if (device && device.name) {
          // 只处理有名称的设备
          setDevices((prevDevices) => {
            const exists = prevDevices.some((d) => d.id === device.id);
            if (!exists) {
              return [...prevDevices, device];
            }
            return prevDevices;
          });
        }
      });

      // 10秒后停止扫描
      setTimeout(() => {
        bleManager.stopDeviceScan();
        setIsScanning(false);
      }, 10000);
    } catch (error) {
      console.error("启动扫描失败:", error);
      setIsScanning(false);
    }
  }, []);

  // 连接设备
  const connectDevice = async (device: Device) => {
    try {
      // 停止扫描
      bleManager.stopDeviceScan();

      // 连接设备
      await bleManager.connectToDevice(device.id);
      console.log("设备已连接:", device.name);

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
      // 断开连接
      await device.cancelConnection();
      console.log("设备已断开连接:", device.name);

      // 更新已连接设备列表
      setConnectedDeviceIds((prev) => prev.filter((id) => id !== device.id));
    } catch (error) {
      console.error("断开连接失败:", error);
      alert("断开连接失败");
    }
  };

  // 渲染设备列表项
  const renderItem = ({ item: device }: { item: Device }) => {
    const isConnected = connectedDeviceIds.includes(device.id);

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
          <Text className="text-sm text-gray-500">
            状态: {isConnected ? "已连接" : "未连接"}
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
          disabled={isScanning}
        >
          <ButtonText>{isScanning ? "扫描中..." : "开始扫描"}</ButtonText>
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
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
});
