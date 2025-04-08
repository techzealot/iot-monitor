import { crc16 } from "@/lib/blufi/utils";
import { Buffer } from "@craftzdog/react-native-buffer";

main();

function main() {
    console.log(Buffer.from("1234567890").toString("hex"));
    console.log(crc16(0, Buffer.from("1234567890")));
}