import { Bluetooth } from "@/lib/blufi/constants";
import { EventBus, EventCallback, EventData, EventSubscription } from "@/lib/blufi/eventbus";
import { AuthMode, checksum, ConnectionState, createCtrlFrame, createDataFrame, CtrlFrame, CtrlFrameSubType, DataFrame, DataFrameSubType, decodeData, Frame, FrameCodec, FrameControl, FrameType, OpMode, SecurityMode } from "@/lib/blufi/frame";
import { Buffer } from "@craftzdog/react-native-buffer";
import { BleError, BleManager, Characteristic, Device, ScanOptions, Subscription, UUID } from "react-native-ble-plx";

class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: Map<string, Connection> = new Map();
    private bleManager: BleManager;
    private defaultConfig: ConnectionConfig = { timeout: 3000 };

    private constructor() {
        this.bleManager = new BleManager();
    }

    public startDeviceScan(UUIDs: UUID[] | null,
        options: ScanOptions | null,
        listener: (error: BleError | null, scannedDevice: Device | null) => void): Promise<void> {
        return this.bleManager.startDeviceScan(UUIDs, options, listener);
    }

    public stopDeviceScan(): Promise<void> {
        return this.bleManager.stopDeviceScan();
    }

    /**
     * 获取 ConnectionManager 实例
     */
    public static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    public async connect(deviceId: string, config: ConnectionConfig = this.defaultConfig): Promise<Connection> {
        const device = await this.bleManager.connectToDevice(deviceId);
        const discoveredDevice =
            await device.discoverAllServicesAndCharacteristics();

        const connection = new Connection(discoveredDevice, config);
        await connection.retrieveAllServicesAndCharacteristics();
        await connection.init();
        console.log("bluetooth version:", await connection.getBluetoothVersion());
        console.log("device info:", await connection.getDeviceInfo());
        //清理旧连接
        const oldConnection = this.getConnection(connection.id);
        if (oldConnection) {
            await oldConnection.close();
        }
        this.putConnection(connection);
        return connection;
    }

    public async disconnect(deviceId: string) {
        const connection = this.getConnection(deviceId);
        if (connection) {
            await connection.close();
            this.removeConnection(connection);
        }
    }

    public async disconnectAll() {
        this.connections.forEach(async (connection) => {
            await connection.close();
        });
        this.connections.clear();
    }

    public async destroy() {
        await this.disconnectAll();
        await this.bleManager.destroy();
    }

    /**
    * 获取所有已连接的设备
    * @returns Promise<Device[]> 已连接的设备列表
    */
    public getConnections(): Connection[] {
        return Array.from(this.connections.values());
    }

    public getConnection(deviceId: string): Connection | undefined {
        return this.connections.get(deviceId);
    }

    private async putConnection(connection: Connection) {
        this.connections.set(connection.id, connection);
    }

    private removeConnection(connection: Connection) {
        this.connections.delete(connection.id);
    }

}

interface ConnectionConfig {
    timeout: number;
}


class Connection {
    private _id: string;
    private _name: string;
    private _sequence: number = 0;
    private eventBus: EventBus = new EventBus();
    private resolves: Map<number, () => void> = new Map();
    private subscription?: Subscription;
    private fragmentFrame: Frame | null = null;
    private fragmentOffset: number = 0;
    private payloadSize: number = 20;

    constructor(private readonly device: Device, private config: ConnectionConfig) {
        this._id = device.id;
        this._name = device.name || "Unknown";
    }

    /*         
    MTU = 23 字节 是 BLE 4.0 / 4.1 的默认值，其有效载荷（实际可用的用户数据）取决于协议层的开销：
    ATT 层（Attribute Protocol）：
    写操作（Write Request / Command）：有效载荷 ≤ 20 字节（因 ATT 头占 3 字节）
    读操作（Read Response）：有效载荷 ≤ 22 字节（因 ATT 头仅占 1 字节）
    BLE5.0+:247字节
    */
    public async init(): Promise<void> {
        this.subscription = await this.initMessageCallback();
        //todo：设置mtu
        //await this.device.requestMTU(247);
        //Three bytes BLE header, one byte reserved
        this.payloadSize = this.device.mtu - 4;
    }

    private async initMessageCallback(): Promise<Subscription> {
        //此处的frame是完整的帧，而不是分片帧
        const subscription = await this.onMessageNotify((message: Frame) => {
            if (message.frameType === FrameType.DATA) {
                if (message.frameControl.isRequireAck()) {
                    this.sendAckCtrlFrame(message.sequence).catch(error => {
                        console.error('发送ACK失败:', error);
                    });
                }
                switch (message.subType) {
                    case DataFrameSubType.SUBTYPE_VERSION:
                        this.eventBus.emit(DataFrameSubType.SUBTYPE_VERSION, decodeData(DataFrameSubType.SUBTYPE_VERSION, message.data));
                        break;
                    case DataFrameSubType.SUBTYPE_WIFI_LIST:
                        this.eventBus.emit(DataFrameSubType.SUBTYPE_WIFI_LIST, decodeData(DataFrameSubType.SUBTYPE_WIFI_LIST, message.data));
                        break;
                    case DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE:
                        this.eventBus.emit(DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE, decodeData(DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE, message.data));
                        break;
                    case DataFrameSubType.SUBTYPE_CUSTOM_DATA:
                        this.eventBus.emit(DataFrameSubType.SUBTYPE_CUSTOM_DATA, decodeData(DataFrameSubType.SUBTYPE_CUSTOM_DATA, message.data));
                        break;
                    case DataFrameSubType.SUBTYPE_ERROR:
                        this.eventBus.emit(DataFrameSubType.SUBTYPE_ERROR, decodeData(DataFrameSubType.SUBTYPE_ERROR, message.data));
                        break;
                    default:
                        console.warn(`未转发的数据消息: ${JSON.stringify(message)}`);
                        break;
                }
            } else if (message.frameType === FrameType.CTRL) {
                switch (message.subType) {
                    case CtrlFrameSubType.SUBTYPE_ACK:
                        //ack消息的sequence在data的第0个字节
                        const ackedSequence = message.data.readUInt8(0);
                        console.log("map on receive:", this.resolves);
                        const resolve = this.resolves.get(ackedSequence);
                        if (resolve) {
                            resolve();
                        } else {
                            console.warn(new Date().toISOString(), ` ack: [${ackedSequence}] received but timeout`);
                        }
                        break;
                    default:
                        console.warn(`未转发的控制消息: ${JSON.stringify(message)}`);
                        break;
                }
            }
        });
        return subscription;
    }

    private on<T extends DataFrameSubType>(event: T, callback: EventCallback<EventData[T]>): EventSubscription<T> {
        return this.eventBus.on(event, callback);
    }

    public get id() {
        return this._id;
    }

    public get name() {
        return this._name;
    }

    public async isConnected(): Promise<boolean> {
        return await this.device.isConnected();
    }

    private async sendMessage(frame: Frame): Promise<void> {
        const promise = new Promise<void>((resolve, reject) => {
            //如果需要ack，则需要等待ack消息
            if (frame.frameControl.isRequireAck()) {
                console.log("map on send:", this.resolves);
                //清理资源
                setTimeout(() => {
                    this.resolves.delete(frame.sequence);
                    reject(new Error(`${new Date().toISOString()} ack: [${frame.sequence}] timeout ${this.config.timeout}ms`));
                }, this.config.timeout);
                this.resolves.set(frame.sequence, resolve);
            } else {
                resolve();
            }
        });
        console.log(new Date().toISOString(), " send message:", JSON.stringify(frame));
        await this.device.writeCharacteristicWithResponseForService(
            Bluetooth.SERVICE_UUID,
            Bluetooth.WRITE_CHARACTERISTIC_UUID,
            FrameCodec.encode(frame).toString("base64"),
        );
        return promise;
    }

    private async sendNoDataCtrlFrame(subType: Exclude<CtrlFrameSubType, CtrlFrameSubType.SUBTYPE_ACK>): Promise<void> {
        const frame = this.buildCtrlFrame(subType, Buffer.alloc(0));
        await this.sendMessage(frame);
    }

    private async sendWithDataCtrlFrame(subType: Exclude<CtrlFrameSubType, CtrlFrameSubType.SUBTYPE_ACK>, data: Buffer): Promise<void> {
        const frame = this.buildCtrlFrame(subType, data);
        await this.sendMessage(frame);
    }

    //-------------send control frame start-------------

    /**
     * 发送ACK消息
     * 与有数据的控制命令区别是帧控制里不需要对端ack，否则可能陷入无限循环
     * @param ackedSequence 需要ACK的序列号
     */
    public async sendAckCtrlFrame(ackedSequence: number): Promise<void> {
        const data = Buffer.alloc(2);
        data.writeUInt8(ackedSequence, 0);
        const frame = this.buildCtrlFrame(CtrlFrameSubType.SUBTYPE_ACK, data, false);
        await this.sendMessage(frame);
    }

    public async sendSetSecurityModeCtrlFrame(securityMode: SecurityMode): Promise<void> {
        const data = Buffer.alloc(1);
        data.writeUInt8(securityMode, 0);
        await this.sendWithDataCtrlFrame(CtrlFrameSubType.SUBTYPE_SET_SEC_MODE, data);
    }

    public async sendSetOpModeCtrlFrame(): Promise<void> {
        const data = Buffer.alloc(1);
        data.writeUInt8(OpMode.STATION, 0);
        await this.sendWithDataCtrlFrame(CtrlFrameSubType.SUBTYPE_SET_OP_MODE, data);
    }

    public async sendConnectWifiCtrlFrame(): Promise<void> {
        await this.sendNoDataCtrlFrame(CtrlFrameSubType.SUBTYPE_CONNECT_WIFI);
    }

    public async sendDisconnectWifiCtrlFrame(): Promise<void> {
        await this.sendNoDataCtrlFrame(CtrlFrameSubType.SUBTYPE_DISCONNECT_WIFI);
    }

    public async sendGetWifiStatusCtrlFrame(): Promise<void> {
        await this.sendNoDataCtrlFrame(CtrlFrameSubType.SUBTYPE_GET_WIFI_STATUS);
    }

    public async sendDeauthenticateCtrlFrame(): Promise<void> {
        throw new Error("not implemented");
    }

    public async sendGetVersionCtrlFrame(): Promise<void> {
        await this.sendNoDataCtrlFrame(CtrlFrameSubType.SUBTYPE_GET_VERSION);
    }

    public async sendDisconnectCtrlFrame(): Promise<void> {
        await this.sendNoDataCtrlFrame(CtrlFrameSubType.SUBTYPE_CLOSE_CONNECTION);
    }

    public async sendGetWifiListCtrlFrame(): Promise<void> {
        await this.sendNoDataCtrlFrame(CtrlFrameSubType.SUBTYPE_GET_WIFI_LIST);
    }

    //-------------send control frame end-------------  
    //-------------send data frame start-------------

    private async sendDataFrame(subType: DataFrameSubType, data: Buffer): Promise<void> {
        const frame = this.buildDataFrame(subType, data);
        await this.sendMessage(frame);
    }

    public async sendNegotiateDataFrame(data: Buffer): Promise<void> {
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_NEG, data);
    }

    public async sendStaWifiBssidDataFrame(bssid: string): Promise<void> {
        const data = Buffer.from(bssid);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_STA_WIFI_BSSID, data);
    }

    public async sendStaWifiSsidDataFrame(ssid: string): Promise<void> {
        const data = Buffer.from(ssid);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_STA_WIFI_SSID, data);
    }

    public async sendStaWifiPasswordDataFrame(password: string): Promise<void> {
        const data = Buffer.from(password);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_STA_WIFI_PASSWORD, data);
    }

    public async sendSoftapWifiSsidDataFrame(ssid: string): Promise<void> {
        const data = Buffer.from(ssid);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SOFTAP_WIFI_SSID, data);
    }

    public async sendSoftapWifiPasswordDataFrame(password: string): Promise<void> {
        const data = Buffer.from(password);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SOFTAP_WIFI_PASSWORD, data);
    }

    public async sendSoftapMaxConnectionCountDataFrame(maxConnectionCount: number): Promise<void> {
        if (maxConnectionCount < 1 || maxConnectionCount > 4) {
            throw new Error("maxConnectionCount must be between 1 and 4");
        }
        const data = Buffer.alloc(1);
        data.writeUInt8(maxConnectionCount, 0);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SOFTAP_MAX_CONNECTION_COUNT, data);
    }

    public async sendSoftapAuthModeDataFrame(authMode: AuthMode): Promise<void> {
        const data = Buffer.alloc(1);
        data.writeUInt8(authMode, 0);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SOFTAP_AUTH_MODE, data);
    }

    public async sendSoftapChannelDataFrame(channel: number): Promise<void> {
        if (channel < 1 || channel > 14) {
            throw new Error("channel must be between 1 and 14");
        }
        const data = Buffer.alloc(1);
        data.writeUInt8(channel, 0);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SOFTAP_CHANNEL, data);
    }

    public async sendUsernameDataFrame(username: string): Promise<void> {
        const data = Buffer.from(username);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_USERNAME, data);
    }

    public async sendCaCertificationDataFrame(caCertification: string): Promise<void> {
        const data = Buffer.from(caCertification);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_CA_CERTIFICATION, data);
    }

    public async sendClientCertificationDataFrame(clientCertification: string): Promise<void> {
        const data = Buffer.from(clientCertification);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_CLIENT_CERTIFICATION, data);
    }

    public async sendServerCertificationDataFrame(serverCertification: string): Promise<void> {
        const data = Buffer.from(serverCertification);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SERVER_CERTIFICATION, data);
    }

    public async sendClientPrivateKeyDataFrame(clientPrivateKey: string): Promise<void> {
        const data = Buffer.from(clientPrivateKey);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_CLIENT_PRIVATE_KEY, data);
    }

    public async sendServerPrivateKeyDataFrame(serverPrivateKey: string): Promise<void> {
        const data = Buffer.from(serverPrivateKey);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_SERVER_PRIVATE_KEY, data);
    }

    //15 Wi-Fi Connection State Report
    //16 Version
    //17 Wi-Fi List
    //18 report Error
    //19 Custom Data
    public async sendCustomDataDataFrame(data: Buffer): Promise<void> {
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_CUSTOM_DATA, data);
    }
    //20 Wi-Fi STA Max Conn Retry
    public async sendWifiStaMaxConnRetryDataFrame(maxConnRetry: number): Promise<void> {
        const data = Buffer.alloc(1);
        data.writeUInt8(maxConnRetry, 0);
        await this.sendDataFrame(DataFrameSubType.SUBTYPE_WIFI_STA_MAX_CONN_RETRY, data);
    }
    //21 Wi-Fi STA Conn End Reason
    //22 Wi-Fi STA Conn RSSI

    //-------------send data frame end------------- 






    /**
     * 监听消息通知
     * 用于设置通知监听
     * ESP32 可以主动发送数据（使用 notify()）
     * 不需要每次请求，ESP32 可以随时发送数据
     * 适合持续接收数据的场景
     * 数据量不能超过MTU,多余的数据会丢失;需要在esp32中实现数据分包以及在手机端实现数据重组
     * @param device 蓝牙设备
     * @param callback 回调函数
     * @returns Promise<Subscription> 订阅对象
     */
    private async onMessageNotify(callback: (message: Frame) => void): Promise<Subscription> {
        const subscription = this.device.monitorCharacteristicForService(
            Bluetooth.SERVICE_UUID,
            Bluetooth.NOTIFY_CHARACTERISTIC_UUID,
            (error: Error | null, characteristic: Characteristic | null) => {
                if (error) {
                    console.warn("Monitor error:", error);
                    return;
                }
                if (characteristic?.value) {
                    const decodedValue = Buffer.from(
                        characteristic.value,
                        "base64",
                    );
                    FrameCodec.logHex("receive message", decodedValue);
                    const frame = FrameCodec.decode(decodedValue);
                    console.log(new Date().toISOString(), " receive message:", JSON.stringify(frame));
                    //合并分片数据组成完整消息然后再触发回调
                    if (this.fragmentFrame === null) {
                        if (frame.frameControl.hasFragment()) {
                            const totalLength = frame.data.readUInt16LE(0);
                            const buffer = Buffer.alloc(totalLength);
                            this.fragmentOffset += frame.data.copy(buffer, 0, 2);
                            this.fragmentFrame = frame;
                            this.fragmentFrame.length = totalLength;
                            this.fragmentFrame.data = buffer;
                        } else {
                            callback(frame);
                        }
                    } else {
                        this.fragmentOffset += frame.data.copy(this.fragmentFrame.data, this.fragmentOffset, 0);
                        if (this.fragmentOffset === this.fragmentFrame.length) {
                            callback(this.fragmentFrame);
                            this.fragmentFrame = null;
                            this.fragmentOffset = 0;
                        }
                    }
                }
            }
        );
        return subscription;
    }

    /**
     * 获取服务的所有特征
     * @param device 蓝牙设备
     * @returns Promise<Characteristic[]> 特征列表
     */
    public async retrieveAllServicesAndCharacteristics(): Promise<void> {
        try {
            console.log("开始发现服务和特征...");
            await this.device.discoverAllServicesAndCharacteristics();
            // 获取所有服务
            const services = await this.device.services();
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

    private get sequence() {
        return this._sequence;
    }

    private set sequence(value: number) {
        //sequence最大为255
        this._sequence = value & 0xff;
    }

    public nextSequence() {
        return this.sequence++;
    }

    private buildCtrlFrame(subType: CtrlFrameSubType, data: Buffer, isRequireAck: boolean = true): CtrlFrame {
        const sequence = this.nextSequence();
        const frameControl = FrameControl.buildDefaultOutput(isRequireAck);
        if (frameControl.hasFragment()) {
            throw new Error("fragment not supported");
        }
        if (frameControl.isEncrypted()) {
            throw new Error("encrypted not supported");
        }
        return createCtrlFrame({
            subType,
            frameControl,
            sequence: sequence,
            length: data.length,
            data: data,
            checksum: checksum(sequence, data.length, data),
        });
    }

    public buildDataFrame(subType: DataFrameSubType, data: Buffer): DataFrame {
        const sequence = this.nextSequence();
        const frameControl = FrameControl.buildDefaultOutput();
        if (frameControl.hasFragment()) {
            throw new Error("fragment not supported");
        }
        if (frameControl.isEncrypted()) {
            throw new Error("encrypted not supported");
        }
        return createDataFrame({
            subType,
            frameControl,
            sequence: sequence,
            length: data.length,
            data: data,
            checksum: checksum(sequence, data.length, data),
        });
    }

    public onReceiveVersion(callback: (data: { greatVersion: number, subVersion: number }) => void): Connection {
        this.eventBus.on(DataFrameSubType.SUBTYPE_VERSION, callback);
        return this;
    }

    public onReceiveWifiList(callback: (data: { ssid: string, rssi: number }[]) => void): Connection {
        this.eventBus.on(DataFrameSubType.SUBTYPE_WIFI_LIST, callback);
        return this;
    }

    public onReceiveWifiConnectionState(callback: (data: { opMode: OpMode, connectionState: ConnectionState, softApConnectedCount: number, rest: Buffer }) => void): Connection {
        this.eventBus.on(DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE, callback);
        return this;
    }

    public onReceiveCustomData(callback: (data: { data: Buffer }) => void): Connection {
        this.eventBus.on(DataFrameSubType.SUBTYPE_CUSTOM_DATA, callback);
        return this;
    }

    public onReceiveError(callback: (data: { error: string, code: number }) => void): Connection {
        this.eventBus.on(DataFrameSubType.SUBTYPE_ERROR, callback);
        return this;
    }

    public async getDeviceInfo(): Promise<{
        id: string;
        name: string | null;
        rssi: number | null;
        mtu: number | null;
        manufacturerData: string | null;
        serviceData: { [uuid: string]: string } | null;
        serviceUUIDs: string[] | null;
        localName: string | null;
        txPowerLevel: number | null;
        solicitedServiceUUIDs: string[] | null;
        isConnectable: boolean | null;
        overflowServiceUUIDs: string[] | null;
    }> {
        try {
            const device = this.device;
            return {
                id: device.id,
                name: device.name,
                rssi: device.rssi,
                mtu: device.mtu,
                manufacturerData: device.manufacturerData,
                serviceData: device.serviceData,
                serviceUUIDs: device.serviceUUIDs,
                localName: device.localName,
                txPowerLevel: device.txPowerLevel,
                solicitedServiceUUIDs: device.solicitedServiceUUIDs,
                isConnectable: device.isConnectable,
                overflowServiceUUIDs: device.overflowServiceUUIDs,
            };
        } catch (error) {
            console.error('获取设备信息失败:', error);
            throw error;
        }
    }

    public async close() {
        if (await this.device.isConnected()) {
            await this.device.cancelConnection();
        }
        this.eventBus.clear();
        //TODO: 需要清理资源
        this.subscription?.remove();
    }

    public async getBluetoothVersion(): Promise<string> {
        try {
            let info = '设备信息:\n';

            // 从 GAP 服务读取设备名称 (2A00)
            const deviceNameChar = await this.device.readCharacteristicForService(
                '00001800-0000-1000-8000-00805f9b34fb', // GAP Service
                '00002a00-0000-1000-8000-00805f9b34fb'  // Device Name Characteristic
            );
            if (deviceNameChar?.value) {
                const deviceName = Buffer.from(deviceNameChar.value, 'base64').toString('utf8');
                info += `设备名称: ${deviceName}\n`;
            }

            // 从 GAP 服务读取外观 (2A01)
            const appearanceChar = await this.device.readCharacteristicForService(
                '00001800-0000-1000-8000-00805f9b34fb', // GAP Service
                '00002a01-0000-1000-8000-00805f9b34fb'  // Appearance Characteristic
            );
            if (appearanceChar?.value) {
                const appearance = Buffer.from(appearanceChar.value, 'base64').readUInt16LE(0);
                info += `外观: 0x${appearance.toString(16)}\n`;
            }

            // 从 GAP 服务读取连接参数 (2A04)
            const connParamChar = await this.device.readCharacteristicForService(
                '00001800-0000-1000-8000-00805f9b34fb', // GAP Service
                '00002a04-0000-1000-8000-00805f9b34fb'  // Peripheral Preferred Connection Parameters
            );
            if (connParamChar?.value) {
                const params = Buffer.from(connParamChar.value, 'base64');
                const minInterval = params.readUInt16LE(0) * 1.25; // ms
                const maxInterval = params.readUInt16LE(2) * 1.25; // ms
                const latency = params.readUInt16LE(4);
                const timeout = params.readUInt16LE(6) * 10; // ms
                info += `连接参数:\n`;
                info += `  - 最小间隔: ${minInterval}ms\n`;
                info += `  - 最大间隔: ${maxInterval}ms\n`;
                info += `  - 延迟: ${latency}\n`;
                info += `  - 超时: ${timeout}ms\n`;
            }

            // 添加 MTU 信息
            const mtu = this.device.mtu;
            info += `MTU: ${mtu}\n`;
            info += `推断蓝牙版本: ${mtu === 23 ? '蓝牙 4.0/4.1' : mtu > 23 && mtu <= 185 ? '蓝牙 4.2' : '蓝牙 5.0 或更高'}`;

            return info;
        } catch (error) {
            console.error('获取蓝牙信息失败:', error);
            return '未知';
        }
    }
}

export const connectionManager = ConnectionManager.getInstance();
export { Connection, ConnectionConfig };
