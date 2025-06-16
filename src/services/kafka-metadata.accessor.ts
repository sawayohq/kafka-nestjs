import { Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KAFKA_CONSUMER_METADATA, KAFKA_PROCESSOR_METADATA } from '../constants/kafka.constants';
import { KafkaConsumerOptions } from '../decorators/kafka.decorator';

@Injectable()
export class KafkaMetadataAccessor {
  private readonly reflector: Reflector;
  constructor() {
    this.reflector = new Reflector();
  }


  isProcessor(target: Type<any> | Function): boolean {
    if (!target) {
      return false;
    }
    return !!this.reflector.get(KAFKA_PROCESSOR_METADATA, target);
  }

  getConsumerOptionsMetadata(target: Type<any> | Function): KafkaConsumerOptions {
    return this.reflector.get(KAFKA_CONSUMER_METADATA, target);
  }
}
