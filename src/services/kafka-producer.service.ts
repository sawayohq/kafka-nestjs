import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, Optional } from '@nestjs/common';
import { ICustomPartitioner, Kafka, KafkaConfig, logLevel, Partitioners, Producer, ProducerRecord } from 'kafkajs';
import { KAFKA_MODULE_OPTIONS } from '../constants/kafka.constants';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  readonly logger = new Logger(KafkaProducerService.name);

  private kafka: Kafka;
  private producer: Producer;

  constructor(
    @Optional()
    @Inject('KAFKA_PARTITIONER')
    readonly createPartitioner: ICustomPartitioner = Partitioners.DefaultPartitioner,
    @Inject(KAFKA_MODULE_OPTIONS)
    private readonly options: KafkaConfig,
  ) {
    this.kafka = new Kafka(this.options);
    this.producer = this.kafka.producer({
      createPartitioner: this.createPartitioner,
    });
  }

  async onModuleInit() {

    await this.producer.connect();
    if (this.options.logLevel === logLevel.DEBUG) {
      this.logger.log(
        {
          message: 'Kafka producer connected',
          info: {
            clientId: this.options.clientId,
            brokers: this.options.brokers,
          },
        },
        this.onModuleInit.name,
      );
    }
  }

  async send(payload: ProducerRecord) {
    await this.producer.send(payload);
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect();
      if (this.options.logLevel === logLevel.DEBUG) {
        this.logger.log(
          {
            message: 'Kafka producer disconnected',
            info: {
              clientId: this.options.clientId,
              brokers: this.options.brokers,
            },
          },
          this.onModuleDestroy.name,
        );
      }
    }
  }
}
