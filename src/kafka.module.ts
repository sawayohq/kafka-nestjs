import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { ConfigurableModuleClass } from "./kafka.module-definition";
import { KafkaMetadataAccessor } from "./services/kafka-metadata.accessor";
import { KafkaProducerService } from "./services/kafka-producer.service";
import { KafkaExplorer } from "./services/kafka.explorer";

@Module({
  imports: [DiscoveryModule],
  exports: [KafkaProducerService, KafkaExplorer],
  providers: [
    {
      provide: "KAFKA_PARTITIONER",
      useValue: undefined,
    },
    KafkaMetadataAccessor,
    KafkaProducerService,
    KafkaExplorer,
  ],
})
export class KafkaModule extends ConfigurableModuleClass {}
