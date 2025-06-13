import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { Kafka, EachMessagePayload, Consumer, KafkaConfig, KafkaJSProtocolError } from 'kafkajs';
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
import { KAFKA_PROCESSOR_METADATA } from '../decorators/kafka-processor.decorator';

@Injectable()
export class KafkaDynamicListenerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KafkaDynamicListenerService.name);
  private readonly kafka: Kafka;
  private readonly groupIds = new Set<string>();
  private readonly consumers: Consumer[] = [];
  private initialized = false;

  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(KAFKA_MODULE_OPTIONS)
    private readonly options: KafkaConfig,
  ) {
    this.kafka = new Kafka(this.options);
  }

  private async ensureTopicExists(topic: string): Promise<void> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const topics = await admin.listTopics();
      if (!topics.includes(topic)) {
        await admin.createTopics({
          topics: [{
            topic,
            numPartitions: 1,
            replicationFactor: 1,
          }],
        });
      }
      
      await admin.disconnect();
    } catch (error) {
      this.logger.error({
        message: `Failed to ensure topic exists`,
        info: {
          topic,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...error
          },
        },
      });
      throw error;
    }
  }

  async onApplicationBootstrap() {
    if (this.initialized) {
      return;
    }

    if (this.modulesContainer.size === 0) {
      this.logger.error({
        message: 'No modules found in container',
        info: {
          modulesContainer: this.modulesContainer,
        },
      });
      return;
    }
    
    const topicPromises: Promise<void>[] = [];
    const consumerPromises: Promise<void>[] = [];
    
    for (const moduleRef of this.modulesContainer.values()) {
      for (const provider of [...moduleRef.providers.values()]) {
        const { instance } = provider;
        if (!instance || typeof instance !== 'object') continue;

        // Check if the class is a Kafka processor
        const isKafkaProcessor = this.reflector.get(
          KAFKA_PROCESSOR_METADATA,
          instance.constructor,
        );

        if (!isKafkaProcessor) continue;
        
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
            try {
              // Create topics in parallel
              for (const topic of metadata.subscribe.topics) {
                if (typeof topic === 'string') {
                  topicPromises.push(this.ensureTopicExists(topic));
                }
              }
              
              // Bind consumers in parallel
              consumerPromises.push(
                this.bindConsumer(
                  {
                    name: methodName,
                    path: method.toString(),
                    provider: provider.name,
                    module: moduleRef.name,
                  },
                  metadata,
                  method.bind(instance),
                )
              );
            } catch (error) {
              if (error instanceof KafkaJSProtocolError) {
                this.logger.error({
                  message: `Kafka protocol error for method`,
                  info: {
                    methodName,
                    error: {
                      stack: error.stack,
                      ...error,
                    },
                  },
                });
              } else {
                this.logger.error({
                  message: `Error binding consumer for method`,
                  info: {
                    methodName,
                    error: {
                      message: error.message,
                      stack: error.stack,
                      name: error.name,
                      ...error
                    },
                  },
                });
              }
            }
          }
        }
      }
    }

    // Wait for all topics to be created
    await Promise.all(topicPromises);
    
    // Wait for all consumers to be bound
    await Promise.all(consumerPromises);

    this.initialized = true;
  }

  async bindConsumer(
    methodDescription: {
      name: string;
      path: string;
      provider: string;
      module: string;
    },
    options: KafkaConsumerOptions,
    handler: (message: any, payload?: EachMessagePayload) => Promise<void>,
  ) {
    const groupId = options.consumerConfig.groupId;
    if (this.groupIds.has(groupId)) {
      throw new KafkaDuplicateGroupIdServerException(methodDescription);
    }
    this.groupIds.add(groupId);

    const consumer = this.kafka.consumer(options.consumerConfig);
    this.consumers.push(consumer);

    try {
      await consumer.connect();
      await consumer.subscribe(options.subscribe);
      await consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const value = payload.message.value?.toString();
          try {
            const parsed = value ? JSON.parse(value) : null;
            await handler.call(handler, parsed, payload);
          } catch (error) {
            this.logger.error(
              {
                message: `Kafka message handler error for topic`,
                info: {
                  error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    ...error
                  },
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
          message: `Kafka consumer registered for topic`,
          info: {
            options,
          },
        },
        this.bindConsumer.name,
      );
    } catch (error) {
      this.logger.error(
        {
          message: `Failed to bind consumer`,
          info: {
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
              ...error
            },
            options,
          },
        },
        this.bindConsumer.name,
      );
      throw error;
    }
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
              message: 'Error disconnecting Kafka consumer',
              info: {
                error: {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                  ...error
                },
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
