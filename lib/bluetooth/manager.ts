import { BleManager, Subscription } from "react-native-ble-plx";

// 创建全局单例
class BluetoothManager {
    private static instance: BluetoothManager;
    private manager: BleManager;
    private monitorSubscriptions: Map<string, Subscription[]>;

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
}

// 导出单例实例
export const bluetoothManager = BluetoothManager.getInstance();
export const bleManager = bluetoothManager.getManager();
