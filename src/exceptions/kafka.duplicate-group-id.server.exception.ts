import { ServerException } from "./server.exception";

export class KafkaDuplicateGroupIdServerException extends ServerException {
  constructor(methodDescription: {
    name: string;
    path: string;
    provider: string;
    module: string;
  }) {
    super({
      information: {
        message: `Duplicate Kafka consumer groupId detected in the same process. Cannot bind multiple consumers with the same groupId.\n${methodDescription.module} > ${methodDescription.provider} > ${methodDescription.name}`,
        identifier: 'kafka.duplicate-group-id',
      },
    });
  }
}
