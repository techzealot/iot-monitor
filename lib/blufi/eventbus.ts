import { ConnectionStateWithOthers, DataFrameSubType, OpModeWithOthers } from "@/lib/blufi/frame";
import { Buffer } from "@craftzdog/react-native-buffer";

export type EventCallback<T = any> = (data: T) => void;

// 定义已实现的事件类型
type ImplementedEventData = {
    // 协商相关
    [DataFrameSubType.SUBTYPE_NEG]: {
        negotiationData: Buffer;
        randomData: Buffer;
        customData: Buffer;
    };

    // AP模式WiFi配置
    [DataFrameSubType.SUBTYPE_SOFTAP_MAX_CONNECTION_COUNT]: { maxConnCount: number };
    [DataFrameSubType.SUBTYPE_SOFTAP_AUTH_MODE]: { authMode: number };
    [DataFrameSubType.SUBTYPE_SOFTAP_CHANNEL]: { channel: number };

    // 状态和版本信息
    [DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE]: {
        opMode: OpModeWithOthers;
        connectionState: ConnectionStateWithOthers;
        softApConnectedCount: number;
        rest: Buffer;
    };
    [DataFrameSubType.SUBTYPE_VERSION]: {
        greatVersion: number;
        subVersion: number
    };
    [DataFrameSubType.SUBTYPE_WIFI_LIST]: {
        ssid: string;
        rssi: number;
    }[];

    // 错误和自定义数据
    [DataFrameSubType.SUBTYPE_ERROR]: {
        error: string;
        code: number;
    };
    [DataFrameSubType.SUBTYPE_CUSTOM_DATA]: {
        data: Buffer;
    };

    // WiFi连接状态
    [DataFrameSubType.SUBTYPE_WIFI_STA_MAX_CONN_RETRY]: {
        maxConnRetry: number;
    };
    [DataFrameSubType.SUBTYPE_WIFI_STA_CONN_END_REASON]: {
        code: number;
        description: string;
    };
    [DataFrameSubType.SUBTYPE_WIFI_STA_CONN_END_RSSI]: {
        rssi: number;
    };
};

// 定义未实现的事件类型
type UnimplementedEventData = Record<
    | DataFrameSubType.SUBTYPE_STA_WIFI_BSSID
    | DataFrameSubType.SUBTYPE_STA_WIFI_SSID
    | DataFrameSubType.SUBTYPE_STA_WIFI_PASSWORD
    | DataFrameSubType.SUBTYPE_SOFTAP_WIFI_SSID
    | DataFrameSubType.SUBTYPE_SOFTAP_WIFI_PASSWORD
    | DataFrameSubType.SUBTYPE_USERNAME
    | DataFrameSubType.SUBTYPE_CA_CERTIFICATION
    | DataFrameSubType.SUBTYPE_CLIENT_CERTIFICATION
    | DataFrameSubType.SUBTYPE_SERVER_CERTIFICATION
    | DataFrameSubType.SUBTYPE_CLIENT_PRIVATE_KEY
    | DataFrameSubType.SUBTYPE_SERVER_PRIVATE_KEY,
    //可以添加其他事件类型,注意不要与已实现的数值枚举冲突
    never
>;

// 合并所有事件类型
export type EventData = ImplementedEventData & UnimplementedEventData;

export class EventSubscription<T extends keyof EventData> {
    constructor(
        private event: T,
        private callback: EventCallback<EventData[T]>,
        private eventBus: EventBus
    ) { }

    /**
     * 取消订阅
     */
    unsubscribe(): void {
        this.eventBus.un(this.event, this.callback);
    }
}

export class EventBus {
    private listeners: Map<keyof EventData, Set<EventCallback<any>>> = new Map();

    /**
     * 订阅事件
     * @param event 事件类型
     * @param callback 回调函数
     * @returns 订阅对象，用于取消订阅
     */
    on<T extends keyof EventData>(event: T, callback: EventCallback<EventData[T]>): EventSubscription<T> {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        return new EventSubscription(event, callback, this);
    }

    /**
     * 取消订阅事件
     * @param event 事件类型
     * @param callback 回调函数
     */
    un<T extends keyof EventData>(event: T, callback: EventCallback<EventData[T]>): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    /**
     * 触发事件
     * @param event 事件类型
     * @param data 事件数据
     */
    emit<T extends keyof EventData>(event: T, data: EventData[T]): void {
        const callbacks = this.listeners.get(event);
        if (!callbacks || callbacks.size == 0) {
            console.warn(`事件${event}没有监听器,data:${JSON.stringify(data)}`);
            return;
        }
        callbacks.forEach(callback => callback(data));
    }

    /**
     * 清除所有事件监听器
     */
    clear(): void {
        this.listeners.clear();
    }

    /**
     * 清除指定事件的所有监听器
     * @param event 事件类型
     */
    clearEvent(event: keyof EventData): void {
        this.listeners.delete(event);
    }
} 