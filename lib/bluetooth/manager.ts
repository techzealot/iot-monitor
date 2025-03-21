import { Buffer } from "@craftzdog/react-native-buffer";
import { BleManager, Characteristic, Device, Subscription } from "react-native-ble-plx";

// 创建全局单例
class BluetoothManager {
    // 服务uuid和特性uuid从combo文档中获取
    static readonly SERVICE_UUID = "55535343-fe7d-4ae5-8fa9-9fafd205e455";
    static readonly WRITE_CHARACTERISTIC_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
    // read和notify特证是相同的
    static readonly NOTIFY_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
    static readonly READ_CHARACTERISTIC_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

    private static instance: BluetoothManager;
    private manager: BleManager;
    private serviceUUIDs = [
        "55535343-fe7d-4ae5-8fa9-9fafd205e455",
    ];

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
     * 监听消息通知 一般不使用 能接收的数据量很小只有20字节
     * @param device 蓝牙设备
     * @param callback 回调函数
     * @returns Promise<Subscription> 订阅对象
     */
    public async onMessageNotify(device: Device, callback: (message: string) => void): Promise<Subscription> {
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
    public async retrieveServiceCharacteristics(device: Device): Promise<Characteristic[]> {
        try {
            console.log("开始获取服务特征...");
            const discoveredDevice = await device.discoverAllServicesAndCharacteristics();
            const services = await discoveredDevice.services();
            console.log("发现服务数量:", services.length);

            // 查找目标服务
            const targetService = services.find(
                service => service.uuid === BluetoothManager.SERVICE_UUID
            );

            if (targetService) {
                const characteristics = await targetService.characteristics();
                console.log("目标服务特征数量:", characteristics.length);

                // 遍历并打印所有特征信息
                characteristics.forEach(characteristic => {
                    console.log("特征信息:", {
                        uuid: characteristic.uuid,
                        isNotifying: characteristic.isNotifying,
                        isWritableWithResponse: characteristic.isWritableWithResponse,
                        isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
                        isReadable: characteristic.isReadable,
                    });
                });

                return characteristics;
            } else {
                console.log("未找到目标服务");
                return [];
            }
        } catch (error) {
            console.error("获取服务特征失败:", error);
            return [];
        }
    }
}

// 导出单例实例
export const bluetoothManager = BluetoothManager.getInstance();
export const bleManager = bluetoothManager.getManager();
