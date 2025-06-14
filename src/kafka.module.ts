import { Module, Global, DynamicModule, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { KafkaExplorer } from './services/kafka.explorer';
import {
  SharedKafkaAsyncConfiguration,
} from './interfaces/shared-queue-async-configuration';
import { KAFKA_MODULE_OPTIONS } from './constants/kafka.constants';
import { KafkaProducerService } from './services/kafka-producer.service';
import { KafkaConfig } from 'kafkajs';
import { KafkaCoreModule } from './kafka-core.module';
import { KafkaMetadataAccessor } from './services/kafka-metadata.accessor';

@Global()
@Module({})
export class KafkaModule {

  private static createBaseProviders(): Provider[] {
    return [
      {
        provide: 'KAFKA_PARTITIONER',
        useValue: undefined,
      },
      KafkaExplorer,
      KafkaProducerService,
      KafkaMetadataAccessor
    ];
  }

  static forProducer(): DynamicModule {
    return {
      module: KafkaModule,
      imports: [KafkaCoreModule.forRoot(), DiscoveryModule],
      providers: KafkaModule.createBaseProviders(),
      exports: [KafkaProducerService, KafkaExplorer],
    };
  }

  static forRoot(options: KafkaConfig): DynamicModule {
    return {
      module: KafkaModule,
      imports: [KafkaCoreModule.forRoot(), DiscoveryModule],
      providers: [
        {
          provide: KAFKA_MODULE_OPTIONS,
          useValue: options,
        },
        ...KafkaModule.createBaseProviders()
      ],
      exports: [KafkaProducerService, KafkaExplorer, KAFKA_MODULE_OPTIONS],
    };
  }

  static forRootAsync(options: SharedKafkaAsyncConfiguration): DynamicModule {
    const asyncProvider: Provider = {
      provide: KAFKA_MODULE_OPTIONS,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory!(...args);
        return config;
      },
      inject: options.inject || [],
    };

    return {
      module: KafkaModule,
      imports: [KafkaCoreModule.forRoot(), DiscoveryModule],
      providers: [
        asyncProvider,
        ...KafkaModule.createBaseProviders(),
      ],
      exports: [KafkaProducerService, KafkaExplorer, KAFKA_MODULE_OPTIONS],
    };
  }
}