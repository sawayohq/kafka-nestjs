import { KafkaConfig } from "kafkajs";
import { Module, DynamicModule, Global } from '@nestjs/common';
import { KafkaProducerService } from './services/kafka-producer.service';
import { KafkaExplorer } from './services/kafka.explorer';
import { KAFKA_MODULE_OPTIONS } from './constants/kafka.constants';
import { KafkaMetadataAccessor } from "./services/kafka-metadata.accessor";
import { DiscoveryModule } from "@nestjs/core";


@Global()
@Module({})
export class KafkaModule {

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