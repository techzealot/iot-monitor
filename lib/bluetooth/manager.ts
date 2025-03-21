import { Buffer } from "@craftzdog/react-native-buffer";
import { BleManager, Characteristic, Device, Subscription } from "react-native-ble-plx";

// 创建全局单例
class BluetoothManager {
    // 定义服务和特征 UUID
    static readonly SERVICE_UUID = "55535343-fe7d-4ae5-8fa9-9fafd205e455";
    static readonly NOTIFY_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
    static readonly WRITE_CHARACTERISTIC_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";

    private static instance: BluetoothManager;
    private manager: BleManager;
    private monitorSubscriptions: Map<string, Subscription[]>;
    private serviceUUIDs = [
        "55535343-fe7d-4ae5-8fa9-9fafd205e455",
        "00112233-4455-6677-8899-aabbccddeeff",
    ];

    private constructor() {
        this.manager = new BleManager();
        this.monitorSubscriptions = new Map();
    }

    public static getInstance(): BluetoothManager {
        if (!BluetoothManager.instance) {
            BluetoothManager.instance = new BluetoothManager();
        }
        return BluetoothManager.instance;
    }

    public getManager(): BleManager {
        return this.manager;
    }

    // 添加监听器
    public addMonitorSubscription(deviceId: string, subscription: Subscription) {
        const subs = this.monitorSubscriptions.get(deviceId) || [];
        subs.push(subscription);
        this.monitorSubscriptions.set(deviceId, subs);
    }

    // 移除设备的所有监听器
    public removeDeviceMonitors(deviceId: string) {
        const subs = this.monitorSubscriptions.get(deviceId);
        if (subs) {
            subs.forEach(sub => sub.remove());
            this.monitorSubscriptions.delete(deviceId);
            console.log(`已移除设备 ${deviceId} 的所有监听器`);
        }
    }

    public destroy() {
        // 清理所有监听器
        this.monitorSubscriptions.forEach((subs, deviceId) => {
            subs.forEach(sub => sub.remove());
        });
        this.monitorSubscriptions.clear();

        if (this.manager) {
            this.manager.destroy();
        }
    }

    /**
     * 获取所有已连接的设备
     * @returns Promise<Device[]> 已连接的设备列表
     */
    public async getConnectedDevices(): Promise<Device[]> {
        return this.manager.connectedDevices(this.serviceUUIDs);
    }

    public async sendMessage(device: Device, message: string) {
        const discoveredDevice =
            await device.discoverAllServicesAndCharacteristics();
        // 发送数据
        const messageBuffer = Buffer.from(message);
        const base64Message = messageBuffer.toString("base64");
        await discoveredDevice.writeCharacteristicWithResponseForService(
            BluetoothManager.SERVICE_UUID,
            BluetoothManager.WRITE_CHARACTERISTIC_UUID,
            base64Message,
        );
    }

    public async onMessageReceived(device: Device, callback: (message: string) => void): Promise<Subscription> {
        const discoveredDevice: Device =
            await device.discoverAllServicesAndCharacteristics();
        return discoveredDevice.monitorCharacteristicForService(
            BluetoothManager.SERVICE_UUID,
            BluetoothManager.NOTIFY_CHARACTERISTIC_UUID,
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
                    callback(decodedValue);
                }
            }
        );
    }
}

// 导出单例实例
export const bluetoothManager = BluetoothManager.getInstance();
export const bleManager = bluetoothManager.getManager();
