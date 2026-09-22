import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm/dist/interfaces/typeorm-options.interface';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from './common/audit/audit.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './modules/health/controllers/health.controller';
import { PatientsModule } from './modules/patients/patients.module';
import { TagsModule } from './modules/tags/tags.module';
import { PaymentProvidersModule } from './modules/payment-providers/payment-providers.module';
import { StaffModule } from './modules/staff/staff.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { VisitsModule } from './modules/visits/visits.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { FormsModule } from './modules/forms/forms.module';
import { RequestsModule } from './modules/requests/requests.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IdentityProxyModule } from './modules/identity-proxy/identity-proxy.module';
import { AuthProxyModule } from './modules/auth-proxy/auth-proxy.module';
import { LocationProxyModule } from './modules/location-proxy/location-proxy.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { WardsModule } from './modules/wards/wards.module';
import { BedsModule } from './modules/beds/beds.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { SeedsModule } from './modules/seeds/seeds.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: Number(config.get<string>('DB_PORT', '5432')),
          username: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgres'),
          database: config.get<string>('DB_NAME', 'emr'),
          autoLoadEntities: true,
          synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
          dropSchema: config.get<string>('DB_DROP_SCHEMA', 'false') === 'true',
          logging: config.get<string>('TYPEORM_LOGGING', 'false') === 'true',
        };
      },
    }),
    AuditModule,
    IdentityProxyModule,
    AuthProxyModule,
    LocationProxyModule,
    PatientsModule,
    TagsModule,
    PaymentProvidersModule,
    StaffModule,
    DepartmentsModule,
    WardsModule,
    BedsModule,
    AdmissionsModule,
    AppointmentsModule,
    VisitsModule,
    EncountersModule,
    FormsModule,
    RequestsModule,
    DashboardModule,
    SeedsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
