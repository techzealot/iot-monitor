import { crc16 } from "@/lib/blufi/utils";
import { Buffer } from "@craftzdog/react-native-buffer";
import { EventData } from "./eventbus";

/**
 * 底层帧编码器，不处理帧分片与帧合并
 */
class FrameCodec {
    /**
     * 编码帧
     * @param frame 
     * @returns 
     */
    public static encode(frame: Frame): Buffer {
        //1+1+1+1+{data length}+2
        const buffer = Buffer.alloc(6 + frame.length);
        //低2位是帧类型，高6位是子类型
        buffer.writeUInt8(frame.frameType + (frame.subType << 2), 0);
        buffer.writeUInt8(frame.frameControl.value, 1);
        buffer.writeUInt8(frame.sequence, 2);
        buffer.writeUInt8(frame.length, 3);
        frame.data.copy(buffer, 4);
        buffer.writeUInt16LE(frame.checksum, 4 + frame.length);
        return buffer;
    }

    public static logHex(message: string, buffer: Buffer) {
        console.log(message, " : ", buffer.toString('hex'));
    }

    public static decode(buffer: Buffer): Frame {
        const frameType = buffer.readUInt8(0) & 0x03;
        const subType = (buffer.readUInt8(0) >> 2) & 0x3f;
        const frameControl = new FrameControl(buffer.readUInt8(1));
        if (frameControl.isEncrypted()) {
            throw new Error("encrypted not supported");
        }
        const sequence = buffer.readUInt8(2);
        const length = buffer.readUInt8(3);
        const data = buffer.slice(4, 4 + length);
        let receivedChecksum = 0;
        if (frameControl.isChecksum()) {
            receivedChecksum = buffer.readUInt16LE(4 + length);
            if (receivedChecksum !== checksum(sequence, length, data)) {
                console.error("checksum error:", receivedChecksum, sequence, length, data.toString('hex'), checksum(sequence, length, data));
                throw new Error("checksum error");
            }
        }
        return { frameType, subType, frameControl, sequence, length, data, checksum: receivedChecksum };
    }
}

enum FrameType {
    CTRL = 0x00,
    DATA = 0x01,
}

enum CtrlFrameSubType {
    SUBTYPE_ACK = 0x00,// 确认
    SUBTYPE_SET_SEC_MODE = 0x01,// 设置安全模式
    SUBTYPE_SET_OP_MODE = 0x02,// 设置操作模式
    SUBTYPE_CONNECT_WIFI = 0x03,// 连接Wi-Fi
    SUBTYPE_DISCONNECT_WIFI = 0x04,// 断开Wi-Fi
    SUBTYPE_GET_WIFI_STATUS = 0x05,// 获取Wi-Fi状态
    SUBTYPE_DEAUTHENTICATE = 0x06,// 取消认证,断开与AP的连接
    SUBTYPE_GET_VERSION = 0x07,// 获取版本
    SUBTYPE_CLOSE_CONNECTION = 0x08,// 关闭连接
    SUBTYPE_GET_WIFI_LIST = 0x09,// 获取Wi-Fi列表
}
enum DataFrameSubType {
    SUBTYPE_NEG = 0x00, // 协商秘钥
    SUBTYPE_STA_WIFI_BSSID = 0x01, // 设置STA模式连接WiFi的BSSID
    SUBTYPE_STA_WIFI_SSID = 0x02, // 设置STA模式连接WiFi的SSID
    SUBTYPE_STA_WIFI_PASSWORD = 0x03, // 设置STA模式连接WiFi的密码
    SUBTYPE_SOFTAP_WIFI_SSID = 0x04, // 设置AP模式连接WiFi的SSID
    SUBTYPE_SOFTAP_WIFI_PASSWORD = 0x05, // 设置AP模式连接WiFi的密码
    SUBTYPE_SOFTAP_MAX_CONNECTION_COUNT = 0x06, // 设置AP模式连接WiFi的最大连接数
    SUBTYPE_SOFTAP_AUTH_MODE = 0x07, // 设置AP模式连接WiFi的认证模式
    SUBTYPE_SOFTAP_CHANNEL = 0x08, // 设置AP模式连接WiFi的信道
    SUBTYPE_USERNAME = 0x09, // 设置用户名
    SUBTYPE_CA_CERTIFICATION = 0x0a, // 设置CA证书
    SUBTYPE_CLIENT_CERTIFICATION = 0x0b, // 设置客户端证书
    SUBTYPE_SERVER_CERTIFICATION = 0x0c, // 设置服务器证书
    SUBTYPE_CLIENT_PRIVATE_KEY = 0x0d, // 设置客户端私钥
    SUBTYPE_SERVER_PRIVATE_KEY = 0x0e, // 设置服务器私钥
    SUBTYPE_WIFI_CONNECTION_STATE = 0x0f, // 获取Wi-Fi连接状态
    SUBTYPE_VERSION = 0x10, // 获取版本
    SUBTYPE_WIFI_LIST = 0x11, // 获取Wi-Fi列表
    SUBTYPE_ERROR = 0x12, // 获取错误
    SUBTYPE_CUSTOM_DATA = 0x13, // 获取自定义数据
    SUBTYPE_WIFI_STA_MAX_CONN_RETRY = 0x14, // 获取Wi-Fi STA最大连接重试次数
    SUBTYPE_WIFI_STA_CONN_END_REASON = 0x15, // 获取Wi-Fi STA连接结束原因
    SUBTYPE_WIFI_STA_CONN_END_RSSI = 0x16, // 获取Wi-Fi STA连接结束时RSSI
}

interface BaseFrame {
    frameControl: FrameControl;
    sequence: number;
    length: number;
    data: Buffer;
    checksum: number;
}

interface CtrlFrame extends BaseFrame {
    frameType: FrameType.CTRL;
    subType: CtrlFrameSubType;
}

interface DataFrame extends BaseFrame {
    frameType: FrameType.DATA;
    subType: DataFrameSubType;
}

type Frame = CtrlFrame | DataFrame;

function createCtrlFrame(init: Omit<CtrlFrame, 'frameType'>): CtrlFrame {
    return {
        frameType: FrameType.CTRL,
        ...init
    };
}

function createDataFrame(init: Omit<DataFrame, 'frameType'>): DataFrame {
    return {
        frameType: FrameType.DATA,
        ...init
    };
}

/**
 * 计算校验和 sequence+length+data
 * @param frame 
 * @returns 
 */
function checksum(sequence: number, length: number, data: Buffer): number {
    const willCheckBuffer = Buffer.alloc(2);
    willCheckBuffer.writeUInt8(sequence, 0);
    willCheckBuffer.writeUInt8(length, 1);
    let checksum = crc16(0, willCheckBuffer);
    if (length > 0) {
        checksum = crc16(checksum, data);
    }
    return checksum;
}

function isAckFrame(frame: Frame): boolean {
    return frame.frameType === FrameType.CTRL && frame.subType === CtrlFrameSubType.SUBTYPE_ACK;
}

/**
 * 0 means from the mobile phone to the ESP device.
 * 1 means from the ESP device to the mobile phone.
 */
enum DataDirection {
    INPUT,
    OUTPUT,
}

class FrameControl {
    private static FRAME_CTRL_POSITION_ENCRYPTED = 0;
    private static FRAME_CTRL_POSITION_CHECKSUM = 1;
    private static FRAME_CTRL_POSITION_DATA_DIRECTION = 2;
    private static FRAME_CTRL_POSITION_REQUIRE_ACK = 3;
    private static FRAME_CTRL_POSITION_FRAG = 4;

    constructor(readonly value: number) {
        this.value = value;
    }

    private check(position: number) {
        return ((this.value >> position) & 1) == 1;
    }

    public isEncrypted(): boolean {
        return this.check(FrameControl.FRAME_CTRL_POSITION_ENCRYPTED);
    }

    public isChecksum(): boolean {
        return this.check(FrameControl.FRAME_CTRL_POSITION_CHECKSUM);
    }

    public isInput(): boolean {
        return this.check(FrameControl.FRAME_CTRL_POSITION_DATA_DIRECTION);
    }

    public isRequireAck(): boolean {
        return this.check(FrameControl.FRAME_CTRL_POSITION_REQUIRE_ACK);
    }

    public hasFragment(): boolean {
        return this.check(FrameControl.FRAME_CTRL_POSITION_FRAG);
    }

    /**
     * 构建默认的输出帧控制
     * 安信可暂不支持加密
     * @returns 
     */
    public static buildDefaultOutput({ isRequireAck = true, isEncrypted = false, hasFragment = false } = {}): FrameControl {
        return FrameControl.build({
            isEncrypted,
            isChecksum: true,
            dataDirection: DataDirection.OUTPUT,
            isRequireAck,
            hasFragment,
        });
    }

    public static build({ isEncrypted, isChecksum, dataDirection, isRequireAck, hasFragment }: { isEncrypted: boolean, isChecksum: boolean, dataDirection: DataDirection, isRequireAck: boolean, hasFragment: boolean }) {
        let value = 0;
        if (isEncrypted) {
            value |= 1 << FrameControl.FRAME_CTRL_POSITION_ENCRYPTED;
        }
        if (isChecksum) {
            value |= 1 << FrameControl.FRAME_CTRL_POSITION_CHECKSUM;
        }
        if (dataDirection === DataDirection.INPUT) {
            value |= 1 << FrameControl.FRAME_CTRL_POSITION_DATA_DIRECTION;
        }
        if (isRequireAck) {
            value |= 1 << FrameControl.FRAME_CTRL_POSITION_REQUIRE_ACK;
        }
        if (hasFragment) {
            value |= 1 << FrameControl.FRAME_CTRL_POSITION_FRAG;
        }
        return new FrameControl(value);
    }
}

/**
 * 
 * 0x00: sequence error
 * 
 * 0x01: checksum error
 * 
 * 0x02: decrypt error
 * 
 * 0x03: encrypt error
 * 
 * 0x04: init security error
 * 
 * 0x05: dh malloc error
 * 
 * 0x06: dh param error
 * 
 * 0x07: read param error
 * 
 * 0x08: make public error
 * 
 * 0x09: data format error
 * 
 * 0x0a: calculate MD5 error
 * 
 * 0x0b: Wi-Fi scan error
 */
enum ReportError {
    SEQUENCE_ERROR = 0x00,
    CHECKSUM_ERROR = 0x01,
    DECRYPT_ERROR = 0x02,
    ENCRYPT_ERROR = 0x03,
    INIT_SECURITY_ERROR = 0x04,
    DH_MALLOC_ERROR = 0x05,
    DH_PARAM_ERROR = 0x06,
    READ_PARAM_ERROR = 0x07,
    MAKE_PUBLIC_ERROR = 0x08,
    DATA_FORMAT_ERROR = 0x09,
    CALCULATE_MD5_ERROR = 0x0a,
    WIFI_SCAN_ERROR = 0x0b,
}
enum OpMode {
    NULL = 0x00,
    STATION = 0x01,
    SOFTAP = 0x02,
    STATION_SOFTAP = 0x03,
}

type OpModeWithOthers = OpMode | number;

enum SecurityMode {
    NO_CHECKSUM_NO_ENCRYPT = 0x00,
    CHECKSUM_NO_ENCRYPT = 0x01,
    NO_CHECKSUM_ENCRYPT = 0x02,
    CHECKSUM_ENCRYPT = 0x03,
}

/**
 * 0x00: OPEN
 * 
 * 0x01: WEP
 * 
 * 0x02: WPA_PSK
 * 
 * 0x03: WPA2_PSK

 * 0x04: WPA_WPA2_PSK
 */
enum AuthMode {
    OPEN = 0x00,
    WEP = 0x01,
    WPA_PSK = 0x02,
    WPA2_PSK = 0x03,
    WPA_WPA2_PSK = 0x04,
}

enum WifiErrReason {
    /**< Unspecified reason */
    WIFI_REASON_UNSPECIFIED = 1,
    /**< Authentication expired */
    WIFI_REASON_AUTH_EXPIRE = 2,
    /**< Deauthentication due to leaving */
    WIFI_REASON_AUTH_LEAVE = 3,
    /**< Disassociated due to inactivity */
    WIFI_REASON_ASSOC_EXPIRE = 4,
    /**< Too many associated stations */
    WIFI_REASON_ASSOC_TOOMANY = 5,
    /**< Class 2 frame received from nonauthenticated STA */
    WIFI_REASON_NOT_AUTHED = 6,
    /**< Class 3 frame received from nonassociated STA */
    WIFI_REASON_NOT_ASSOCED = 7,
    /**< Deassociated due to leaving */
    WIFI_REASON_ASSOC_LEAVE = 8,
    /**< Association but not authenticated */
    WIFI_REASON_ASSOC_NOT_AUTHED = 9,
    /**< Disassociated due to poor power capability */
    WIFI_REASON_DISASSOC_PWRCAP_BAD = 10,
    /**< Disassociated due to unsupported channel */
    WIFI_REASON_DISASSOC_SUPCHAN_BAD = 11,
    /**< Disassociated due to BSS transition */
    WIFI_REASON_BSS_TRANSITION_DISASSOC = 12,
    /**< Invalid Information Element (IE) */
    WIFI_REASON_IE_INVALID = 13,
    /**< MIC failure */
    WIFI_REASON_MIC_FAILURE = 14,
    /**< 4-way handshake timeout */
    WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT = 15,
    /**< Group key update timeout */
    WIFI_REASON_GROUP_KEY_UPDATE_TIMEOUT = 16,
    /**< IE differs in 4-way handshake */
    WIFI_REASON_IE_IN_4WAY_DIFFERS = 17,
    /**< Invalid group cipher */
    WIFI_REASON_GROUP_CIPHER_INVALID = 18,
    /**< Invalid pairwise cipher */
    WIFI_REASON_PAIRWISE_CIPHER_INVALID = 19,
    /**< Invalid AKMP */
    WIFI_REASON_AKMP_INVALID = 20,
    /**< Unsupported RSN IE version */
    WIFI_REASON_UNSUPP_RSN_IE_VERSION = 21,
    /**< Invalid RSN IE capabilities */
    WIFI_REASON_INVALID_RSN_IE_CAP = 22,
    /**< 802.1X authentication failed */
    WIFI_REASON_802_1X_AUTH_FAILED = 23,
    /**< Cipher suite rejected */
    WIFI_REASON_CIPHER_SUITE_REJECTED = 24,
    /**< TDLS peer unreachable */
    WIFI_REASON_TDLS_PEER_UNREACHABLE = 25,
    /**< TDLS unspecified */
    WIFI_REASON_TDLS_UNSPECIFIED = 26,
    /**< SSP requested disassociation */
    WIFI_REASON_SSP_REQUESTED_DISASSOC = 27,
    /**< No SSP roaming agreement */
    WIFI_REASON_NO_SSP_ROAMING_AGREEMENT = 28,
    /**< Bad cipher or AKM */
    WIFI_REASON_BAD_CIPHER_OR_AKM = 29,
    /**< Not authorized in this location */
    WIFI_REASON_NOT_AUTHORIZED_THIS_LOCATION = 30,
    /**< Service change precludes TS */
    WIFI_REASON_SERVICE_CHANGE_PERCLUDES_TS = 31,
    /**< Unspecified QoS reason */
    WIFI_REASON_UNSPECIFIED_QOS = 32,
    /**< Not enough bandwidth */
    WIFI_REASON_NOT_ENOUGH_BANDWIDTH = 33,
    /**< Missing ACKs */
    WIFI_REASON_MISSING_ACKS = 34,
    /**< Exceeded TXOP */
    WIFI_REASON_EXCEEDED_TXOP = 35,
    /**< Station leaving */
    WIFI_REASON_STA_LEAVING = 36,
    /**< End of Block Ack (BA) */
    WIFI_REASON_END_BA = 37,
    /**< Unknown Block Ack (BA) */
    WIFI_REASON_UNKNOWN_BA = 38,
    /**< Timeout */
    WIFI_REASON_TIMEOUT = 39,
    /**< Peer initiated disassociation */
    WIFI_REASON_PEER_INITIATED = 46,
    /**< AP initiated disassociation */
    WIFI_REASON_AP_INITIATED = 47,
    /**< Invalid FT action frame count */
    WIFI_REASON_INVALID_FT_ACTION_FRAME_COUNT = 48,
    /**< Invalid PMKID */
    WIFI_REASON_INVALID_PMKID = 49,
    /**< Invalid MDE */
    WIFI_REASON_INVALID_MDE = 50,
    /**< Invalid FTE */
    WIFI_REASON_INVALID_FTE = 51,
    /**< Transmission link establishment failed */
    WIFI_REASON_TRANSMISSION_LINK_ESTABLISH_FAILED = 67,
    /**< Alternative channel occupied */
    WIFI_REASON_ALTERATIVE_CHANNEL_OCCUPIED = 68,
    /**< Beacon timeout */
    WIFI_REASON_BEACON_TIMEOUT = 200,
    /**< No AP found */
    WIFI_REASON_NO_AP_FOUND = 201,
    /**< Authentication failed */
    WIFI_REASON_AUTH_FAIL = 202,
    /**< Association failed */
    WIFI_REASON_ASSOC_FAIL = 203,
    /**< Handshake timeout */
    WIFI_REASON_HANDSHAKE_TIMEOUT = 204,
    /**< Connection failed */
    WIFI_REASON_CONNECTION_FAIL = 205,
    /**< AP TSF reset */
    WIFI_REASON_AP_TSF_RESET = 206,
    /**< Roaming */
    WIFI_REASON_ROAMING = 207,
    /**< Association comeback time too long */
    WIFI_REASON_ASSOC_COMEBACK_TIME_TOO_LONG = 208,
    /**< SA query timeout */
    WIFI_REASON_SA_QUERY_TIMEOUT = 209,
    /**< No AP found with compatible security */
    WIFI_REASON_NO_AP_FOUND_W_COMPATIBLE_SECURITY = 210,
    /**< No AP found in auth mode threshold */
    WIFI_REASON_NO_AP_FOUND_IN_AUTHMODE_THRESHOLD = 211,
    /**< No AP found in RSSI threshold */
    WIFI_REASON_NO_AP_FOUND_IN_RSSI_THRESHOLD = 212,
}

/**
 * 0x0 indicates a connection state with IP address
 * 0x1 represent a disconnected state
 * 0x2 indicates a connecting state
 * 0x3 indicates a connection state but no IP address
 */
enum ConnectionState {
    CONNECTED = 0x00,
    DISCONNECTED = 0x01,
    CONNECTING = 0x02,
    CONNECTED_NO_IP = 0x03,
}

type ConnectionStateWithOthers = ConnectionState | number;

/**
 * 解码数据
 * @param subType 
 * @param data 
 * @returns 
 */
function decodeDataFrameDataPart<T extends DataFrameSubType>(subType: T, data: Buffer): EventData[T] {
    switch (subType) {
        case DataFrameSubType.SUBTYPE_SOFTAP_MAX_CONNECTION_COUNT:
            return {
                maxConnCount: data.readUInt8(0),
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_SOFTAP_AUTH_MODE:
            return {
                authMode: data.readUInt8(0),
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_SOFTAP_CHANNEL:
            return {
                channel: data.readUInt8(0),
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE:
            return parseWifiState(data) as EventData[T];
        case DataFrameSubType.SUBTYPE_VERSION:
            return {
                greatVersion: data.readUInt8(0),
                subVersion: data.readUInt8(1)
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_WIFI_LIST:
            return parseWifiList(data) as EventData[T];
        case DataFrameSubType.SUBTYPE_ERROR:
            const code = data.readUInt8(0);
            return {
                error: ReportError[code],
                code: code
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_CUSTOM_DATA:
            return {
                data: data,
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_WIFI_STA_CONN_END_REASON:
            const reason = data.readUInt8(0);
            return {
                code: reason,
                description: WifiErrReason[reason]
            } as EventData[T];
        case DataFrameSubType.SUBTYPE_WIFI_STA_CONN_END_RSSI:
            return {
                rssi: data.readInt8(0),
            } as EventData[T];
        default:
            throw new Error(`Unsupported subType: ${subType}`);
    }
}

/**
 * 解析Wi-Fi列表数据
 * 数据格式:length(1byte)+rssi(1byte)+ssid(length-1byte)
 * @param data 
 * @returns 
 */
function parseWifiList(data: Buffer): EventData[DataFrameSubType.SUBTYPE_WIFI_LIST] {
    const wifiList: { ssid: string; rssi: number; }[] = [];
    let offset = 0;
    while (offset < data.length) {
        const length = data.readUInt8(offset);
        offset++;
        const rssi = data.readInt8(offset);
        offset++;
        const ssid = data.slice(offset, offset + length - 1).toString('utf8');
        offset += length - 1;
        wifiList.push({ ssid, rssi });
    }
    return wifiList;
}

/**
 * 解析Wi-Fi状态数据
 * 数据格式:opMode(1byte)+connectionState(1byte)+softApConnectedCount(1byte)+rawRest(rawRest.length)
 * @param data 
 * @returns 
 */
function parseWifiState(data: Buffer): EventData[DataFrameSubType.SUBTYPE_WIFI_CONNECTION_STATE] {
    const opMode = toOpMode(data.readUInt8(0));
    const connectionState = toConnectionState(data.readUInt8(1));
    const softApConnectedCount = data.readUInt8(2);
    if (data.length <= 3) {
        return {
            opMode,
            connectionState,
            softApConnectedCount,
            rawRest: data.slice(3),
        };
    }
    const { staSsid, staBssid, maxConnRetry, connEndReasonCode, connEndRssi } = parseWifiExtraState(data.slice(3));
    return {
        opMode,
        connectionState,
        softApConnectedCount,
        rawRest: data.slice(3),
        staSsid,
        staBssid,
        maxConnRetry,
        connEndReasonCode,
        connEndRssi,
    }
}

function toOpMode(value: number): OpModeWithOthers {
    if (Object.values(OpMode).includes(value)) {
        return value as OpMode;
    }
    return value;
}

function toConnectionState(value: number): ConnectionStateWithOthers {
    if (Object.values(ConnectionState).includes(value)) {
        return value as ConnectionState;
    }
    return value;
}


class WifiState {
    staBssid?: string;
    staSsid?: string;
    maxConnRetry?: number;
    connEndReasonCode?: number;
    connEndRssi?: number;
}

/**
 * 解析Wi-Fi状态数据
 * 数据格式:infoType(1byte)+infoLength(1byte)+infoData(infoLength)
 * @param rest data[3~]
 * @returns 
 */
function parseWifiExtraState(rest: Buffer): WifiState {
    let offset = 0;
    const length = rest.length;
    const result: WifiState = {};
    while (offset < length) {
        const infoType = rest.readUInt8(offset);
        offset++;
        if (offset >= length) {
            console.warn(`error wifi state data,no enough data`);
            break;
        }
        const infoLength = rest.readUInt8(offset++);
        switch (infoType) {
            case DataFrameSubType.SUBTYPE_STA_WIFI_BSSID:
                result.staBssid = rest.slice(offset, offset + infoLength).toString('hex');
                break;
            case DataFrameSubType.SUBTYPE_STA_WIFI_SSID:
                result.staSsid = rest.slice(offset, offset + infoLength).toString('utf8');
                break;
            case DataFrameSubType.SUBTYPE_WIFI_STA_MAX_CONN_RETRY:
                result.maxConnRetry = rest.readUInt8(offset);
                break;
            case DataFrameSubType.SUBTYPE_WIFI_STA_CONN_END_REASON:
                result.connEndReasonCode = rest.readUInt8(offset);
                break;
            case DataFrameSubType.SUBTYPE_WIFI_STA_CONN_END_RSSI:
                result.connEndRssi = rest.readInt8(offset);
                break;
            default:
                console.warn(`Unsupported infoType: ${infoType}`);
        }
        offset += infoLength;
    }
    return result;
}

export {
    AuthMode, checksum, ConnectionState, ConnectionStateWithOthers, createCtrlFrame,
    createDataFrame, CtrlFrame, CtrlFrameSubType, DataDirection, DataFrame, DataFrameSubType, decodeDataFrameDataPart as decodeData, Frame, FrameCodec, FrameControl, FrameType, isAckFrame, OpMode, OpModeWithOthers, ReportError, SecurityMode
};

