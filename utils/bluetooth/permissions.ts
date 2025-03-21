import { bleManager } from "@/lib/bluetooth/manager";
import { Permission, PermissionsAndroid, Platform } from "react-native";
import { State } from "react-native-ble-plx";



export const requestPermissions = async () => {
    if (Platform.OS === "android") {
        const apiLevel = Platform.Version;
        const permissions: Permission[] = [];

        // Android 12 (API 31) 及以上版本需要新的蓝牙权限
        if (apiLevel >= 31) {
            permissions.push(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as Permission,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as Permission
            );
        } else {
            // Android 12 以下版本需要位置权限
            permissions.push(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as Permission
            );
        }

        try {
            const granted = await PermissionsAndroid.requestMultiple(permissions);
            return Object.values(granted).every(
                (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
            );
        } catch (err) {
            console.warn(err);
            return false;
        }
    }
    return true;
};

export const enableBluetooth = async () => {
    return new Promise<boolean>((resolve) => {
        const subscription = bleManager.onStateChange((state) => {
            if (state === State.PoweredOn) {
                subscription.remove();
                resolve(true);
            } else if (state === State.PoweredOff) {
                subscription.remove();
                resolve(false);
            }
        }, true);
    });
}; 