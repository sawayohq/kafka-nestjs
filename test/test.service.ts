import { Injectable, Logger } from '@nestjs/common';
import { KafkaConsumer, KafkaProcessor } from '../src/decorators/kafka.decorator';
import { EachMessagePayload } from 'kafkajs';


@Injectable()
@KafkaProcessor()
export class TestService {
  private readonly logger = new Logger(TestService.name);

  constructor() {
    this.logger.log('TestService initialized');
  }

  @KafkaConsumer({
    subscribe: {
      topics: ['test-topic'],
      fromBeginning: true,
    },
    consumerConfig: {
      groupId: 'test-group',
    },
  })
  async handleMessage(message: any, payload: EachMessagePayload) {
    this.logger.log({
      message: 'Received Kafka message',
      info: {
        message,
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
      },
    });
  }
} 