import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Test application is running on http://localhost:${port}`);
}

bootstrap().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
}); 