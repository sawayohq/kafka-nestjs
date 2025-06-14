import { Module, Global, DynamicModule } from '@nestjs/common';
import { MetadataScanner, Reflector, ModulesContainer } from '@nestjs/core';

@Global()
@Module({})
export class KafkaCoreModule {
  static forRoot(): DynamicModule {
    return {
      module: KafkaCoreModule,
      providers: [
        {
          provide: MetadataScanner,
          useValue: new MetadataScanner(),
        },
        {
          provide: Reflector,
          useValue: new Reflector(),
        },
        {
          provide: ModulesContainer,
          useFactory: () => {
            return new ModulesContainer();
          },
        },
      ],
      exports: [
        MetadataScanner,
        Reflector,
        ModulesContainer,
      ],
    };
  }
} 