import { Module, Global, OnModuleInit, DynamicModule } from '@nestjs/common';
import { ModulesContainer, MetadataScanner, Reflector } from '@nestjs/core';

@Global()
@Module({})
export class KafkaCoreModule implements OnModuleInit {
  private static modulesContainer: ModulesContainer;
  private static metadataScanner: MetadataScanner;
  private static reflector: Reflector;

  static forRoot(): DynamicModule {
    this.modulesContainer = new ModulesContainer();
    this.metadataScanner = new MetadataScanner();
    this.reflector = new Reflector();

    return {
      module: KafkaCoreModule,
      providers: [
        {
          provide: ModulesContainer,
          useValue: this.modulesContainer,
        },
        {
          provide: MetadataScanner,
          useValue: this.metadataScanner,
        },
        {
          provide: Reflector,
          useValue: this.reflector,
        },
      ],
      exports: [
        ModulesContainer,
        MetadataScanner,
        Reflector,
      ],
    };
  }

  constructor(private readonly modulesContainer: ModulesContainer) {}

  onModuleInit() {}
} 