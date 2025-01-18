import { Text } from "@/components/ui/text";
import { Link, Stack } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

const NotFound = () => {
  return (
    <View>
      <Stack.Screen options={{ title: "Oops!" }} />
      <Text>Page not found</Text>
      <Link href="/">Go back to home</Link>
    </View>
  );
};

const styles = StyleSheet.create({});

export default NotFound;
