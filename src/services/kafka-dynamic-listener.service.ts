import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { Kafka, EachMessagePayload, Consumer, KafkaConfig } from 'kafkajs';
import { KafkaConsumerOptions } from '../decorators/kafka.decorator';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  KAFKA_CONSUMER_METADATA,
  KAFKA_MODULE_OPTIONS,
} from '../constants/kafka.constants';
import { KafkaDuplicateGroupIdServerException } from '../exceptions/kafka.duplicate-group-id.server.exception';

@Injectable()
export class KafkaDynamicListenerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KafkaDynamicListenerService.name);
  private readonly kafka: Kafka;
  private readonly groupIds = new Set<string>();
  private readonly consumers: Consumer[] = [];

  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(KAFKA_MODULE_OPTIONS)
    private readonly options: KafkaConfig,
  ) {

    this.kafka = new Kafka(this.options);
  }

  async onApplicationBootstrap() {
    for (const moduleRef of this.modulesContainer.values()) {
      for (const provider of [...moduleRef.providers.values()]) {
        const { instance } = provider;
        if (!instance || typeof instance !== 'object') continue;
        const prototype = Object.getPrototypeOf(instance);
        const methodNames = this.metadataScanner.getAllMethodNames(prototype);
        for (const methodName of methodNames) {
          const method = prototype[methodName];
          if (typeof method !== 'function') continue;
          const metadata: KafkaConsumerOptions = this.reflector.get(
            KAFKA_CONSUMER_METADATA,
            method,
          );
          if (metadata) {
            this.bindConsumer(
              {
                name: methodName,
                path: method.toString(),
                provider: provider.name,
                module: moduleRef.name,
              },
              metadata,
              method.bind(instance),
            );
          }
        }
      }
    }
  }

  async bindConsumer(
    methodDescription: {
      name: string;
      path: string;
      provider: string;
      module: string;
    },
    options: KafkaConsumerOptions,
    handler: (message: any) => Promise<void>,
  ) {
    const groupId = options.consumerConfig.groupId;
    if (this.groupIds.has(groupId)) {
      throw new KafkaDuplicateGroupIdServerException(methodDescription);
    }
    this.groupIds.add(groupId);

    const consumer = this.kafka.consumer(options.consumerConfig);
    this.consumers.push(consumer);
    await consumer.connect();
    await consumer.subscribe(options.subscribe);
    await consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        const value = message.value?.toString();
        try {
          const parsed = value ? JSON.parse(value) : null;
          await handler(parsed);
        } catch (error) {
          this.logger.error(
            {
              error,
              message: `Kafka message handler error for topic`,
              info: {
                options,
              },
            },
            this.bindConsumer.name,
          );
        }
      },
    });

    this.logger.log(
      {
        message: `Kafka handler registered for topic`,
        info: {
          options,
        },
      },
      this.bindConsumer.name,
    );
  }

  async onApplicationShutdown() {
    await Promise.all(
      this.consumers.map(async consumer => {
        try {
          await consumer.disconnect();
          this.logger.log(
            {
              message: 'Kafka consumer disconnected',
              info: {
                consumer,
              },
            },
            this.onApplicationShutdown.name,
          );
        } catch (error) {
          this.logger.error(
            {
              error,
              message: 'Error disconnecting Kafka consumer',
              info: {
                consumer,
              },
            },
            this.onApplicationShutdown.name,
          );
        }
      }),
    );
  }
}
