import { Permission, PermissionsAndroid, Platform } from "react-native";

export const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === "android") {
        const apiLevel = Platform.Version as number;
        const permissions: Permission[] = [];

        // Android 12 (API 31) 及以上版本需要新的蓝牙权限
        if (apiLevel >= 31) {
            permissions.push(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as Permission,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as Permission
            );
        }
        // 在所有 Android 版本都请求位置权限，这对扫描至关重要
        permissions.push(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as Permission
        );

        try {
            console.log('请求 Android 权限:', permissions);
            const granted = await PermissionsAndroid.requestMultiple(permissions);
            console.log('权限授予结果:', granted);

            // 检查所有请求的权限是否都被授予
            const allGranted = permissions.every(
                (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
            );

            if (allGranted) {
                console.log('所有必需的 Android 权限已授予');
                return true;
            } else {
                console.warn('部分或全部 Android 权限被拒绝');
                // 可以更详细地打印哪些权限被拒绝
                permissions.forEach(p => {
                    if (granted[p] !== PermissionsAndroid.RESULTS.GRANTED) {
                        console.warn(`权限被拒绝: ${p}`);
                    }
                });
                return false;
            }
        } catch (err) {
            console.warn('请求 Android 权限时出错:', err);
            return false;
        }
    } else if (Platform.OS === 'ios') {
        // iOS 权限通过 Info.plist 配置，系统自动处理请求
        // 这里可以添加检查蓝牙状态的逻辑（如果需要的话，但需要 BleManager 实例）
        console.log('iOS 平台，权限由 Info.plist 和系统处理');
        return true; // 假设 Info.plist 配置正确
    }
    // 其他平台（理论上不存在于 React Native 常见场景）
    return false;
}; 