import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { ArrowRightIcon, Icon } from "@/components/ui/icon";
import { Image } from "@/components/ui/image";
import { Link, LinkText } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { StyleSheet } from "react-native";
const Index = () => {
  return (
    <Card className="m-3 max-w-[360px] rounded-lg p-5">
      <Image
        source={{
          uri: "https://placehold.co/263x240/orange/white.png",
        }}
        className="mb-6 aspect-[263/240] h-[240px] w-full rounded-md"
        alt="image"
      />
      <Text className="mb-2 text-sm font-normal text-typography-700">
        May 15, 2023
      </Text>
      <Heading size="md" className="mb-4">
        The Power of Positive Thinking
      </Heading>
      <Link href="https://gluestack.io/" isExternal>
        <HStack className="items-center">
          <LinkText
            size="sm"
            className="font-semibold text-info-600 no-underline"
          >
            Read Blog
          </LinkText>
          <Icon
            as={ArrowRightIcon}
            size="sm"
            className="ml-0.5 mt-0.5 text-info-600"
          />
        </HStack>
      </Link>
    </Card>
  );
};
const styles = StyleSheet.create({});
export default Index;
