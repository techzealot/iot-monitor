import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text className="text-xl font-bold text-red-700">
        Edit app/index.tsx to edit this screen.
      </Text>
    </View>
  );
}
