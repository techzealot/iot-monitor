# React Native ESP32 BLUFI 库

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)

这是一个用于 React Native 应用的 ESP32 BLUFI 协议实现库。它基于 `react-native-ble-plx`，提供了通过蓝牙低功耗 (BLE) 对 ESP32 设备进行 WiFi 配置（配网）的功能。

## 功能特点

-   **设备发现**: 扫描符合 BLUFI 服务 UUID 的 ESP32 设备。
-   **连接管理**: 建立、维护和断开与 BLUFI 设备的连接。
-   **WiFi 配置**: 支持设置 ESP32 连接到目标 WiFi 网络 (STA 模式)。
    -   发送 SSID 和密码。
    -   设置操作模式 (Station)。
    -   触发连接。
-   **协议实现**: 处理 BLUFI 控制帧和数据帧的发送与接收。
    -   支持帧校验和 (CRC16)。
    -   支持数据分片与重组。
    -   支持 ACK 确认机制。
-   **事件驱动**: 通过事件监听器异步处理设备响应、状态更新和错误。
-   **信息获取**: 获取设备版本、WiFi 列表、连接状态等信息。
-   **自定义数据**: 支持发送和接收自定义数据帧。
-   **类型安全**: 使用 TypeScript 编写，提供类型定义。

## 安装

确保你的项目中已安装以下依赖：

```bash
# 使用 npm
npm install react-native-ble-plx @craftzdog/react-native-buffer

# 或使用 yarn
yarn add react-native-ble-plx @craftzdog/react-native-buffer

# 或使用 pnpm
pnpm add react-native-ble-plx @craftzdog/react-native-buffer
```

并且已正确配置 `react-native-ble-plx` 所需的原生环境。

## 权限要求

在使用此库之前，请确保你的应用已请求并获得了必要的权限：

**Android (`AndroidManifest.xml`)**

```xml
<!-- Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<!-- Android 11 及以下 -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<!-- 如果需要后台扫描或连接，可能还需要 BACKGROUND_LOCATION 权限 -->
```

**iOS (`Info.plist`)**

```xml
<key>NSBluetoothPeripheralUsageDescription</key>
<string>我们需要蓝牙权限来发现和连接 BLUFI 设备进行配网。</string>
<key>NSBluetoothAlwaysUsageDescription</key> <!-- 如果需要后台蓝牙 -->
<string>我们需要蓝牙权限在后台保持与设备的连接。</string>
<key>NSLocationWhenInUseUsageDescription</key> <!-- iOS 13+ 需要位置权限才能扫描 -->
<string>我们需要位置权限来扫描附近的蓝牙设备。</string>
```

## 使用方法

### 1. 导入模块

```typescript
import { connectionManager, Connection } from './lib/blufi/connection'; // 根据你的项目结构调整路径
import { Bluetooth } from './lib/blufi/constants';
import { OpMode, DataFrameSubType, EventData, WifiErrReason, ConnectionState } from './lib/blufi/frame';
import { BleError, Device } from 'react-native-ble-plx';
import { Buffer } from '@craftzdog/react-native-buffer';
```

### 2. 扫描设备

使用 `connectionManager` 扫描具有 BLUFI 服务 UUID 的设备。

```typescript
let foundDevice: Device | null = null;

console.log('开始扫描 BLUFI 设备...');
connectionManager.startDeviceScan([Bluetooth.SERVICE_UUID], null, (error: BleError | null, scannedDevice: Device | null) => {
  if (error) {
    console.error('扫描错误:', error);
    // 处理错误，例如请求权限或提示用户开启蓝牙
    connectionManager.stopDeviceScan(); // 出错时停止扫描
    return;
  }

  if (scannedDevice) {
    console.log(`发现设备: ${scannedDevice.name} (${scannedDevice.id})`);
    // 可以根据设备名称或其他信息进行过滤
    if (scannedDevice.name?.includes('BLUFI')) { // 示例：只连接名字包含 BLUFI 的设备
      foundDevice = scannedDevice;
      console.log(`找到目标设备: ${foundDevice.name}`);
      connectionManager.stopDeviceScan(); // 找到后停止扫描
      // 接下来可以连接设备
      connectToDevice(foundDevice.id);
    }
  }
});

// 设置扫描超时
setTimeout(() => {
  if (!foundDevice) {
    console.log('扫描超时，未找到目标设备');
    connectionManager.stopDeviceScan();
  }
}, 10000); // 10秒超时
```

### 3. 连接设备

使用 `connectionManager.connect()` 连接到设备，并获取 `Connection` 实例。

```typescript
let currentConnection: Connection | null = null;

async function connectToDevice(deviceId: string) {
  try {
    console.log(`正在连接到设备 ${deviceId}...`);
    // 连接并初始化，超时时间可以在 connect 方法的第二个参数配置
    currentConnection = await connectionManager.connect(deviceId, { timeout: 15000 });
    console.log(`设备 ${currentConnection.name} (${currentConnection.id}) 已连接`);

    // 连接成功后，设置事件监听器
    setupEventListeners(currentConnection);

    // 获取设备信息（可选）
    const deviceInfo = await currentConnection.getDeviceInfo();
    console.log('设备信息:', deviceInfo);
    const gattInfo = await currentConnection.getBluetoothVersion(); // 获取 GATT 信息
    console.log('GATT 信息:', gattInfo);


    // 开始配置 WiFi 或执行其他操作
    await configureWifi(currentConnection, 'MyHomeWiFi', 'MyPassword123');

  } catch (error) {
    console.error(`连接到设备 ${deviceId} 失败:`, error);
    currentConnection = null;
    // 可能需要清理状态或重试
  }
}
```

### 4. 监听事件

在获取 `Connection` 实例后，为其添加事件监听器以处理来自设备的响应。

```typescript
function setupEventListeners(connection: Connection) {
  console.log('设置事件监听器...');

  // 监听 WiFi 连接状态报告 (修正版)
  connection.onReceiveWifiConnectionState((data) => { // 类型会自动推断
    console.log('收到 WiFi 连接状态:', JSON.stringify(data));

    // 主要关注 Station 模式下的状态
    if (data.opMode === OpMode.STATION) {
      switch (data.connectionState) {
        case ConnectionState.CONNECTED:
          console.log(`配网成功！已连接到 WiFi: SSID=${data.staSsid}, BSSID=${data.staBssid}`);
          // 可以在这里断开蓝牙连接
          // disconnectDevice(connection.id);
          break;
        case ConnectionState.DISCONNECTED:
        case ConnectionState.CONNECTED_NO_IP: // 也视为一种失败或未完全成功状态
          console.error('配网失败或连接中断。');
          if (data.connEndReasonCode !== undefined) {
            const reason = WifiErrReason[data.connEndReasonCode as WifiErrReason] || `未知代码 (${data.connEndReasonCode})`;
            console.error(`原因: ${reason}`);
            // 可以根据具体原因代码进行处理，例如：
            if (data.connEndReasonCode === WifiErrReason.WIFI_REASON_AUTH_FAIL) {
              console.error("-> 可能是密码错误。");
            } else if (data.connEndReasonCode === WifiErrReason.WIFI_REASON_NO_AP_FOUND) {
              console.error("-> 找不到指定的 WiFi 网络。");
            }
          }
          if (data.connEndRssi !== undefined) {
             console.error(`断开时 RSSI: ${data.connEndRssi}`);
          }
          // 处理失败逻辑
          break;
        case ConnectionState.CONNECTING:
          console.log('WiFi 连接中...');
          if (data.maxConnRetry !== undefined) {
            console.log(`最大重试次数: ${data.maxConnRetry}`);
          }
          break;
        default:
          console.warn(`未知的 Station 连接状态: ${data.connectionState}`);
          break;
      }
    } else if (data.opMode === OpMode.SOFTAP || data.opMode === OpMode.STATION_SOFTAP) {
        console.log(`设备处于 SoftAP 或混合模式，当前连接数: ${data.softApConnectedCount}`);
    } else {
        console.log(`设备处于其他操作模式: ${data.opMode}`);
    }
  });

  // 监听错误报告
  connection.onReceiveError((data: EventData[DataFrameSubType.SUBTYPE_ERROR]) => {
    console.error('收到设备错误报告:', data.error, '代码:', data.code);
    // 处理设备报告的错误
  });

  // 监听版本信息
  connection.onReceiveVersion((data: EventData[DataFrameSubType.SUBTYPE_VERSION]) => {
    console.log('收到设备版本:', `v${data.greatVersion}.${data.subVersion}`);
  });

  // 监听 WiFi 列表
  connection.onReceiveWifiList((data: EventData[DataFrameSubType.SUBTYPE_WIFI_LIST]) => {
      console.log('收到 WiFi 列表:');
      data.forEach(wifi => console.log(`  - SSID: ${wifi.ssid}, RSSI: ${wifi.rssi}`));
  });

  // 监听自定义数据
  connection.onReceiveCustomData((data: EventData[DataFrameSubType.SUBTYPE_CUSTOM_DATA]) => {
      console.log('收到自定义数据:', data.data.toString('hex')); // 或其他解码方式
      // 处理自定义数据
  });

  // 你也可以在这里监听来自 ConnectionManager 或 BLE 底层的错误
  // 例如监听 BleManager 的事件，但这通常由 connectionManager 内部处理
}
```

### 5. 发送命令 (配置 WiFi 示例)

使用 `Connection` 实例的方法发送 BLUFI 命令。

```typescript
async function configureWifi(connection: Connection, ssid: string, password: string) {
  try {
    console.log(`开始配置 WiFi: SSID=${ssid}`);

    // 1. 设置操作模式为 Station
    console.log('设置操作模式为 Station...');
    await connection.sendSetOpModeCtrlFrame(); // 默认发送 OpMode.STATION

    // 2. 发送 SSID
    console.log('发送 SSID...');
    await connection.sendStaWifiSsidDataFrame(ssid);

    // 3. 发送密码
    console.log('发送密码...');
    await connection.sendStaWifiPasswordDataFrame(password);

    // 4. 发送连接命令
    console.log('发送连接命令...');
    await connection.sendConnectWifiCtrlFrame();

    console.log('WiFi 配置命令已发送，等待设备连接状态...');
    // 连接结果将通过 onReceiveWifiConnectionState 事件回调处理

  } catch (error) {
    console.error('配置 WiFi 时出错:', error);
    // 处理发送命令过程中的错误
  }
}
```

### 6. 断开连接

使用 `connectionManager.disconnect()` 断开连接并清理资源。

```typescript
async function disconnectDevice(deviceId: string) {
  try {
    console.log(`正在断开设备 ${deviceId}...`);
    await connectionManager.disconnect(deviceId);
    console.log(`设备 ${deviceId} 已断开`);
    currentConnection = null;
  } catch (error) {
    console.error(`断开设备 ${deviceId} 时出错:`, error);
  }
}

// 在应用退出或不再需要时，销毁 BleManager 实例
function cleanup() {
    console.log('清理 BLUFI 连接...');
    connectionManager.destroy(); // 会断开所有连接并销毁 BleManager
}
```

## API 参考

### `connectionManager` (单例)

通过 `import { connectionManager } from './lib/blufi/connection';` 获取。

-   **`startDeviceScan(uuids: UUID[] | null, options: ScanOptions | null, listener: (error: BleError | null, device: Device | null) => void)`**:
    开始扫描 BLE 设备。
    -   `uuids`: 要扫描的服务 UUID 数组 (对于 BLUFI，通常是 `[Bluetooth.SERVICE_UUID]`)。
    -   `options`: `react-native-ble-plx` 的扫描选项。
    -   `listener`: 扫描回调函数，在发现设备或出错时调用。
-   **`stopDeviceScan()`**: 停止当前的设备扫描。
-   **`connect(deviceId: string, config?: ConnectionConfig): Promise<Connection>`**:
    连接到指定 ID 的设备并完成 BLUFI 初始化。
    -   `deviceId`: 目标设备的 ID。
    -   `config`: 连接配置，目前仅包含 `timeout` (毫秒，默认 3000)。
    -   返回: 一个 Promise，解析为 `Connection` 实例。
-   **`disconnect(deviceId: string): Promise<void>`**: 断开与指定设备的连接并清理相关资源。
-   **`disconnectAll(): Promise<void>`**: 断开所有当前管理的连接。
-   **`destroy(): Promise<void>`**: 断开所有连接并销毁底层的 `BleManager` 实例。应在应用退出或不再需要 BLE 功能时调用。
-   **`getConnection(deviceId: string): Connection | undefined`**: 获取指定 ID 的当前 `Connection` 实例（如果已连接）。
-   **`getConnections(): Connection[]`**: 获取所有当前活动的 `Connection` 实例列表。

### `Connection` 类

代表与单个 BLUFI 设备的活动连接。通过 `connectionManager.connect()` 获取实例。

**属性:**

-   **`id: string`**: 设备 ID。
-   **`name: string`**: 设备名称（可能为 "Unknown"）。

**方法:**

-   **`isConnected(): Promise<boolean>`**: 检查设备当前是否连接。
-   **`getDeviceInfo(): Promise<DeviceInfo>`**: 获取设备的详细信息（ID, Name, RSSI, MTU 等）。 *(DeviceInfo 类型需要定义或从 Connection 导出)*
-   **`getBluetoothVersion(): Promise<string>`**: 尝试读取 GATT 特征来推断蓝牙版本和获取其他 GAP 信息。 *(返回一个包含信息的字符串)*
-   **`close(): Promise<void>`**: 关闭连接和内部资源。通常由 `connectionManager.disconnect()` 调用，用户一般不需要直接调用。

**发送控制帧 (CtrlFrame):**

这些方法发送不需要大量数据的命令。

-   `sendAckCtrlFrame(ackedSequence: number): Promise<void>` (内部使用)
-   `sendSetSecurityModeCtrlFrame(securityMode: SecurityMode): Promise<void>`
-   `sendSetOpModeCtrlFrame(): Promise<void>` (默认发送 OpMode.STATION)
-   `sendConnectWifiCtrlFrame(): Promise<void>`
-   `sendDisconnectWifiCtrlFrame(): Promise<void>`
-   `sendGetWifiStatusCtrlFrame(): Promise<void>`
-   `sendGetVersionCtrlFrame(): Promise<void>`
-   `sendGetWifiListCtrlFrame(): Promise<void>`
-   `sendDisconnectCtrlFrame(): Promise<void>` (请求设备关闭 BLE 连接)

**发送数据帧 (DataFrame):**

这些方法发送可能包含较长数据的配置信息，支持自动分片。

-   `sendStaWifiBssidDataFrame(bssid: string): Promise<void>`
-   `sendStaWifiSsidDataFrame(ssid: string): Promise<void>`
-   `sendStaWifiPasswordDataFrame(password: string): Promise<void>`
-   `sendSoftapWifiSsidDataFrame(ssid: string): Promise<void>`
-   `sendSoftapWifiPasswordDataFrame(password: string): Promise<void>`
-   `sendSoftapMaxConnectionCountDataFrame(maxConnectionCount: number): Promise<void>`
-   `sendSoftapAuthModeDataFrame(authMode: AuthMode): Promise<void>`
-   `sendSoftapChannelDataFrame(channel: number): Promise<void>`
-   `sendCustomDataDataFrame(data: Buffer): Promise<void>`
-   `sendWifiStaMaxConnRetryDataFrame(maxConnRetry: number): Promise<void>`
-   *(其他 SUBTYPE 对应的方法...)*

**接收事件/数据:**

使用这些方法注册回调函数来处理从设备接收到的信息。

-   **`onReceiveVersion(callback: (data: EventData[DataFrameSubType.SUBTYPE_VERSION]) => void): Connection`**: 监听版本信息。`data`: `{ greatVersion: number, subVersion: number }`。
-   **`onReceiveWifiList(callback: (data: EventData[DataFrameSubType.SUBTYPE_WIFI_LIST]) => void): Connection`**: 监听扫描到的 WiFi 列表。`data`: `{ ssid: string, rssi: number }[]`。
-   **`onReceiveWifiConnectionState(callback: (data: EventData[DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE]) => void): Connection`**: 监听 WiFi 连接状态报告。`data` 包含详细的状态信息（参考 `frame.ts` 中的 `parseWifiState` 和相关枚举）。
-   **`onReceiveCustomData(callback: (data: EventData[DataFrameSubType.SUBTYPE_CUSTOM_DATA]) => void): Connection`**: 监听自定义数据。`data`: `{ data: Buffer }`。
-   **`onReceiveError(callback: (data: EventData[DataFrameSubType.SUBTYPE_ERROR]) => void): Connection`**: 监听设备报告的错误。`data`: `{ error: string, code: number }` (错误描述和错误码，参考 `ReportError` 枚举)。

## 错误处理

-   **BLE 操作错误**: `connectionManager` 的方法（如 `startDeviceScan`, `connect`, `disconnect`）以及 `Connection` 的发送方法可能会抛出 `BleError` (来自 `react-native-ble-plx`) 或标准 `Error`。使用 `try...catch` 来捕获这些同步/异步操作中的错误。常见的 `BleError` 包括权限不足、蓝牙未开启、连接超时、设备断开等。
-   **设备报告错误**: ESP32 设备在执行 BLUFI 操作时可能遇到内部错误。这些错误会通过 `DataFrameSubType.SUBTYPE_ERROR` 数据帧发送回来。使用 `connection.onReceiveError()` 监听这些错误。错误代码定义在 `frame.ts` 的 `ReportError` 枚举中。
-   **协议错误**: 库内部处理协议逻辑时也可能出错（如校验和失败、序列号错误、分片错误）。这些错误通常会作为 `Error` 抛出或打印到控制台。
-   **`Operation was cancelled`**: 在调用 `connectionManager.disconnect()` 时，内部会尝试移除特征监听器 (`subscription.remove()`)。如果此时设备已经因为 `disconnect()` 而断开，`remove()` 会抛出一个 `BleError`，其消息通常包含 "Operation was cancelled"。这个错误在断开连接的场景下是**预期行为**，库内部（如果你应用了之前的建议）会捕获并安全地处理它，不会影响断开流程。

## 注意事项

-   **MTU**: 库会根据连接时的 MTU 自动调整数据帧分片大小。如果可能，ESP32 固件应支持协商更高的 MTU (如 BLE 4.2+ 的 185 字节或 BLE 5.0+ 的 247 字节) 以提高效率。库目前没有主动请求更高 MTU 的逻辑，但可以处理设备协商的结果。
-   **加密**: 当前实现不支持 BLUFI 的加密协商 (`DataFrameSubType.SUBTYPE_NEG`)。所有通信都是明文（但带有校验和）。
-   **并发操作**: 避免在同一个 `Connection` 实例上同时发送多个需要 ACK 的命令，因为 ACK 机制是基于序列号的，并发发送可能导致 ACK 超时或混乱。按顺序发送命令通常更安全。
-   **清理**: 确保在不再需要时调用 `connectionManager.destroy()` 来释放资源，防止内存泄漏和不必要的电池消耗。

## 许可证

[MIT](LICENSE.md) 