import { Controller, Post, Body, Logger } from '@nestjs/common';
import { KafkaProducerService } from '../src/services/kafka-producer.service';

@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  @Post('send')
  async sendMessage(@Body() message: any) {
    try {
      await this.kafkaProducer.send({
        topic: 'test-topic',
        messages: [
          {
            value: JSON.stringify(message),
          },
        ],
      });

      this.logger.log({
        message: 'Message sent successfully',
        info: {
          message,
        },
      });

      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      this.logger.error({
        message: 'Failed to send message',
        info: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      });

      throw error;
    }
  }
} 