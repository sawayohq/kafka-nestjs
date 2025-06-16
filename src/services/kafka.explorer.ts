import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { Kafka, EachMessagePayload, Consumer, KafkaConfig, KafkaJSProtocolError } from 'kafkajs';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { KafkaConsumerOptions } from '../decorators/kafka.decorator';
import {
  KAFKA_MODULE_OPTIONS,
} from '../constants/kafka.constants';
import { KafkaMetadataAccessor } from './kafka-metadata.accessor';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

@Injectable()
export class KafkaExplorer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaExplorer.name);
  private readonly kafka: Kafka;
  private readonly consumers: Consumer[] = [];
  private initialized = false;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly metadataAccessor: KafkaMetadataAccessor,
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

  async onModuleInit() {
    await this.explore();
  }

  async onModuleDestroy() {
    await this.destroy();
  }

  async explore() {
    if (this.initialized) {
      return;
    }
    
    const topicPromises: Promise<void>[] = [];
    const consumerPromises: Promise<void>[] = [];
    
    const providers: InstanceWrapper[] = this.discoveryService.getProviders()
      .filter((wrapper: InstanceWrapper) =>
        this.metadataAccessor.isProcessor(
          !wrapper.metatype || wrapper.inject
            ? wrapper.instance?.constructor
            : wrapper.metatype,
        ));
    
    console.log('providers', providers.length);
    providers.forEach(( wrapper: InstanceWrapper ) => {
      const { instance } = wrapper;
      const prototype = Object.getPrototypeOf(instance);
      const methods = this.metadataScanner.getAllMethodNames(prototype)
      .filter(methodName => typeof instance[methodName] === 'function' && methodName !== 'constructor')
      .map(methodName => prototype[methodName]);

      
      methods.forEach( (method) => {
        const kafkaOptions = this.metadataAccessor.getConsumerOptionsMetadata(method);
        if (kafkaOptions) {
          try {
            // Create topics in parallel
            for (const topic of kafkaOptions.subscribe.topics) {
              if (typeof topic === 'string') {
                topicPromises.push(this.ensureTopicExists(topic));
              }
            }

            // Bind consumers in parallel
            consumerPromises.push(
              this.bindConsumer(
                kafkaOptions,
                method.bind(instance),
              )
            );
          } catch (error) {
            if (error instanceof KafkaJSProtocolError) {
              this.logger.error({
                message: `Kafka protocol error for method`,
                info: {
                  methodName: method.name,
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
                  methodName: method.name,
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
      });
    });
 
    // Wait for all topics to be created
    await Promise.all(topicPromises);
    
    // Wait for all consumers to be bound
    await Promise.all(consumerPromises);

    this.initialized = true;
  }

  async bindConsumer(
    options: KafkaConsumerOptions,
    handler: (message: any, payload?: EachMessagePayload) => Promise<void>,
  ) {
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

  async destroy() {
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
            this.destroy.name,
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
            this.destroy.name,
          );
        }
      }),
    );
  }
}
