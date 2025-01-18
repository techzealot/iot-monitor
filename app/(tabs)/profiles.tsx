import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import React from "react";
import { StyleSheet } from "react-native";

const Profiles = () => {
  return (
    <HStack space="md" reversed={false}>
      <Box className="h-20 w-20 bg-primary-300" />
      <Box className="h-20 w-20 bg-primary-400" />
      <Box className="h-20 w-20 bg-primary-500" />
    </HStack>
  );
};

const styles = StyleSheet.create({});

export default Profiles;
