import { KafkaConfig } from "kafkajs";
import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { KafkaProducerService } from './services/kafka-producer.service';
import { KafkaExplorer } from './services/kafka.explorer';
import { KAFKA_MODULE_OPTIONS } from './constants/kafka.constants';
import { KafkaMetadataAccessor } from "./services/kafka-metadata.accessor";
import { DiscoveryModule } from "@nestjs/core";
import { SharedKafkaAsyncConfiguration } from "./interfaces/shared-queue-async-configuration";


@Global()
@Module({})
export class KafkaModule {

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
      global: true,
      module: KafkaModule,
      imports: [DiscoveryModule],
      providers: [
        asyncProvider,
        {
          provide: 'KAFKA_PARTITIONER',
          useValue: undefined,
        },
        KafkaMetadataAccessor,
        KafkaProducerService,
        KafkaExplorer,
      ],
      exports: [KafkaProducerService, KafkaExplorer, asyncProvider],
    };
  }

  static forRoot(options: KafkaConfig): DynamicModule {
    return {
      global: true,
      module: KafkaModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: KAFKA_MODULE_OPTIONS,
          useValue: options,
        },
        {
          provide: 'KAFKA_PARTITIONER',
          useValue: undefined,
        },
        KafkaMetadataAccessor,
        KafkaProducerService,
        KafkaExplorer,
      ],
      exports: [KafkaProducerService, KafkaExplorer, KAFKA_MODULE_OPTIONS],
    };
  }
}