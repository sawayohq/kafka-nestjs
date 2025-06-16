import { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import { KafkaConfig } from 'kafkajs';

export interface SharedKafkaAsyncConfiguration extends Pick<ModuleMetadata, 'imports'> {
  useFactory?: (
    ...args: any[]
  ) => Promise<KafkaConfig> | KafkaConfig;
  inject?: FactoryProvider['inject'];
}