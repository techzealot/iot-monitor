# BLUFI 配网库

这是一个基于 BLUFI 协议的 TypeScript 配网库，用于在 React Native 应用中实现 ESP32 设备的蓝牙配网功能。

## 功能特点

- 支持扫描 BLUFI 设备
- 支持连接和断开设备
- 支持配置 WiFi 凭据
- 完整的事件系统
- 类型安全
- 错误处理

## 安装

确保你的项目中已安装以下依赖：

```bash
pnpm add react-native-ble-plx @craftzdog/react-native-buffer
```

## 使用方法

```typescript
import { Blufi, BlufiStatus, WifiSecurityType } from './lib/blufi';

// 创建 BLUFI 实例
const blufi = new Blufi({
  scanTimeout: 10000,  // 扫描超时时间（毫秒）
  connectTimeout: 15000,  // 连接超时时间（毫秒）
  debug: true  // 启用调试模式
});

// 监听事件
blufi.on('deviceFound', (event) => {
  console.log('发现设备:', event.data);
});

blufi.on('connected', () => {
  console.log('设备已连接');
});

blufi.on('disconnected', () => {
  console.log('设备已断开');
});

blufi.on('error', (event) => {
  console.error('发生错误:', event.data);
});

// 开始扫描
await blufi.startScan();

// 连接到设备
await blufi.connect('device-id');

// 配置 WiFi
await blufi.configureWiFi({
  ssid: 'MyWiFi',
  password: 'MyPassword',
  security: WifiSecurityType.WPA2_PSK
});

// 断开连接
await blufi.disconnect();
```

## API 文档

### Blufi 类

#### 构造函数

```typescript
constructor(config?: BlufiConfig)
```

配置选项：
- `scanTimeout`: 扫描超时时间（毫秒）
- `connectTimeout`: 连接超时时间（毫秒）
- `debug`: 是否启用调试模式

#### 方法

- `startScan()`: 开始扫描 BLUFI 设备
- `stopScan()`: 停止扫描
- `connect(deviceId: string)`: 连接到指定设备
- `configureWiFi(credentials: WiFiCredentials)`: 配置 WiFi 凭据
- `disconnect()`: 断开连接
- `getStatus()`: 获取当前状态
- `on(event: string, callback: (event: BlufiEvent) => void)`: 添加事件监听器

### 事件类型

- `deviceFound`: 发现新设备
- `deviceLost`: 设备丢失
- `connected`: 设备已连接
- `disconnected`: 设备已断开
- `error`: 发生错误

## 注意事项

1. 确保设备已开启蓝牙
2. 确保应用有适当的蓝牙权限
3. 在 iOS 上需要在 Info.plist 中添加蓝牙权限描述
4. 在 Android 上需要在 AndroidManifest.xml 中添加蓝牙权限

## 许可证

MIT 