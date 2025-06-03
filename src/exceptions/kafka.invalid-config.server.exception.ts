import { ServerException } from "./server.exception";

export class KafkaInvalidConfigServerException extends ServerException {
  constructor() {
    super({
      information: {
        message: 'Invalid Kafka configuration',
        identifier: 'kafka.invalid-config',
      },
    });
  }
}
