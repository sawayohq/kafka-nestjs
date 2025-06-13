import { SetMetadata } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

export const KAFKA_PROCESSOR_METADATA = 'KAFKA_PROCESSOR_METADATA';

export function KafkaProcessor(): ClassDecorator {
  return (target: any) => {
    Injectable()(target);
    SetMetadata(KAFKA_PROCESSOR_METADATA, true)(target);
  };
} 