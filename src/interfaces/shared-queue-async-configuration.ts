import { FactoryProvider } from '@nestjs/common';
import { KafkaConfig } from 'kafkajs';

export interface SharedKafkaAsyncConfiguration {
  useFactory?: (
    ...args: any[]
  ) => Promise<KafkaConfig> | KafkaConfig;
  inject?: FactoryProvider['inject'];
}