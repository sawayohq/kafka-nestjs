import { SetMetadata } from '@nestjs/common';
import { KAFKA_CONSUMER_METADATA } from '../constants/kafka.constants';
import { ConsumerSubscribeTopics, ConsumerConfig } from 'kafkajs';

export type KafkaConsumerOptions = {
  subscribe: ConsumerSubscribeTopics;
  consumerConfig: ConsumerConfig;
};

export const KafkaConsumer = (options: KafkaConsumerOptions): MethodDecorator =>
  SetMetadata(KAFKA_CONSUMER_METADATA, options);
