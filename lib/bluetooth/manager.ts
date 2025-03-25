import { Buffer } from "@craftzdog/react-native-buffer";
import { BleManager, Characteristic, Device, Subscription } from "react-native-ble-plx";

// 创建全局单例
class BluetoothManager {
    // 默认服务uuid和特征uuid从combo文档中获取
    static readonly SERVICE_UUID = "55535343-fe7d-4ae5-8fa9-9fafd205e455";
    static readonly WRITE_CHARACTERISTIC_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
    // read和notify特征是相同的
    static readonly NOTIFY_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
    static readonly READ_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

    private static instance: BluetoothManager;
    private manager: BleManager;
    private readonly serviceUUIDs = [
        BluetoothManager.SERVICE_UUID
    ];
    private subscriptions: Map<string, Subscription> = new Map();  // 存储设备ID和对应的订阅

    private constructor() {
        this.manager = new BleManager();
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

    public destroy() {
        if (this.manager) {
            this.cancelAllSubscriptions();
            this.manager.destroy();
        }
    }


    /**
     * 获取所有已连接的设备
     * @returns Promise<Device[]> 已连接的设备列表
     */
    public async getConnectedDevices(): Promise<Device[]> {
        //必须传入serviceUUIDs 否则获取不到设备
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

    /**
     * 监听消息通知
     * 用于设置通知监听
     * ESP32 可以主动发送数据（使用 notify()）
     * 不需要每次请求，ESP32 可以随时发送数据
     * 适合持续接收数据的场景
     * 数据量限制较小(约20字节),超过20字节的数据会被截断,多余的数据会丢失;需要在esp32中实现数据分包以及在手机端实现数据重组
     * @param device 蓝牙设备
     * @param callback 回调函数
     * @returns Promise<Subscription> 订阅对象
     */
    public async onMessageNotify(device: Device, callback: (message: string) => void): Promise<void> {
        const discoveredDevice: Device =
            await device.discoverAllServicesAndCharacteristics();
        const subscription = discoveredDevice.monitorCharacteristicForService(
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
        // 存储订阅
        this.subscriptions.set(device.id, subscription);
    }

    /**
     * 取消设备的所有订阅
     * @param deviceId 设备ID
     */
    public cancelSubscriptions(deviceId: string) {
        const subscription = this.subscriptions.get(deviceId);
        if (subscription) {
            subscription.remove();
            this.subscriptions.delete(deviceId);
        }
    }

    /**
     * 取消所有设备的订阅
     */
    public cancelAllSubscriptions() {
        for (const subscription of this.subscriptions.values()) {
            subscription.remove();
        }
        this.subscriptions.clear();
    }

    /**
     * 读取消息 发送读取请求,需要esp32再回调中设置返回消息,否则会报错
     * 用于主动读取数据
     * 需要每次请求才能获取数据
     * ESP32 必须实现 onRead 回调
     * 适合单次读取数据的场景
     * 数据量可以较大,但是由于MTU限制也需要处理分片和重传,因此推荐使用notify机制
     * @param device 蓝牙设备
     * @param callback 回调函数
     * @returns Promise<void>
     */
    public async readMessage(device: Device, callback: (message: string) => void): Promise<void> {
        const discoveredDevice = await device.discoverAllServicesAndCharacteristics();
        const characteristic = await discoveredDevice.readCharacteristicForService(
            BluetoothManager.SERVICE_UUID,
            BluetoothManager.READ_CHARACTERISTIC_UUID,
        );
        if (characteristic?.value) {
            const decodedValue = Buffer.from(
                characteristic.value,
                "base64",
            ).toString("utf8");
            console.log("收到数据:", decodedValue);
            callback(decodedValue);
        }
    }

    /**
     * 获取服务的所有特征
     * @param device 蓝牙设备
     * @returns Promise<Characteristic[]> 特征列表
     */
    public async retrieveAllServicesAndCharacteristics(device: Device): Promise<void> {
        try {
            console.log("开始发现服务和特征...");
            await device.discoverAllServicesAndCharacteristics();

            // 获取所有服务
            const services = await device.services();
            console.log(`发现 ${services.length} 个服务`);

            // 遍历每个服务
            for (const service of services) {
                console.log(`\n服务 UUID: ${service.uuid}`);
                console.log(`服务是否主要: ${service.isPrimary}`);

                // 获取服务的所有特征
                const characteristics = await service.characteristics();
                console.log(`该服务包含 ${characteristics.length} 个特征`);

                // 遍历每个特征
                for (const characteristic of characteristics) {
                    console.log(`\n  特征 UUID: ${characteristic.uuid}`);
                    console.log(`  特征属性:`);
                    console.log(`    - 可读: ${characteristic.isReadable}`);
                    console.log(`    - 可写(带响应): ${characteristic.isWritableWithResponse}`);
                    console.log(`    - 可写(不带响应): ${characteristic.isWritableWithoutResponse}`);
                    console.log(`    - 可通知: ${characteristic.isNotifiable}`);

                }
            }
        } catch (error) {
            console.error("发现服务和特征失败:", error);
            throw error;
        }
    }
}

// 导出单例实例
export const bluetoothManager = BluetoothManager.getInstance();
export const bleManager = bluetoothManager.getManager();
