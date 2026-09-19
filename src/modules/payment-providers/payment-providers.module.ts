import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentProviderOrmEntity } from './entities/payment-provider.orm-entity';
import { PaymentProvidersService } from './services/payment-providers.service';
import { PaymentProvidersController } from './controllers/payment-providers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentProviderOrmEntity])],
  controllers: [PaymentProvidersController],
  providers: [PaymentProvidersService],
  exports: [PaymentProvidersService],
})
export class PaymentProvidersModule {}
