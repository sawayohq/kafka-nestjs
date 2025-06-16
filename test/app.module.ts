import { Module, OnModuleInit } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import { Logger } from '@nestjs/common';
import { KafkaModule }  from '../src';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: 'clientId',
      brokers: ['localhost:9092'],
      sasl: {
        mechanism: 'plain',
        username: 'kafka',
        password: 'docker123'
      },
      ssl: false
    }),
  ],
  controllers: [TestController],
  providers: [TestService],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly testService: TestService) {}

  onModuleInit() {
    this.logger.log('AppModule initialized');
  }
} 