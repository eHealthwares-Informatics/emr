import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrintOrmEntity } from './entities/print.orm-entity';
import { PrintsController } from './prints.controller';
import { PrintsService } from './prints.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PrintOrmEntity])],
  controllers: [PrintsController],
  providers: [PrintsService],
  exports: [PrintsService],
})
export class PrintsModule {}
