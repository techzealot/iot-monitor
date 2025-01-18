import { Alert, AlertIcon, AlertText } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

const Alerts = () => {
  return (
    <View className="flex-col items-stretch justify-center gap-4">
      <Alert action="success" variant="solid">
        <AlertIcon as={InfoIcon} />
        <AlertText>Description of alert!</AlertText>
      </Alert>
      <Alert action="info" variant="solid">
        <AlertIcon as={InfoIcon} />
        <AlertText>Description of alert!</AlertText>
      </Alert>
      <Alert action="warning" variant="solid">
        <AlertIcon as={InfoIcon} />
        <AlertText>Description of alert!</AlertText>
      </Alert>
      <Alert action="error" variant="solid">
        <AlertIcon as={InfoIcon} />
        <AlertText>Description of alert!</AlertText>
      </Alert>
      <Alert action="muted" variant="solid">
        <AlertIcon as={InfoIcon} />
        <AlertText>Description of alert!</AlertText>
      </Alert>
    </View>
  );
};

const styles = StyleSheet.create({});

export default Alerts;
