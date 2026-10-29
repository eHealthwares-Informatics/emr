import { NestFactory } from '@nestjs/core';
import { ValidationPipe, type LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

// Log verbosity from LOG_LEVEL: error | warn | log/info | debug | verbose | silent.
const LOG_LEVELS: Record<string, LogLevel[]> = {
  error: ['error', 'fatal'],
  warn: ['error', 'fatal', 'warn'],
  log: ['error', 'fatal', 'warn', 'log'],
  info: ['error', 'fatal', 'warn', 'log'],
  debug: ['error', 'fatal', 'warn', 'log', 'debug'],
  verbose: ['error', 'fatal', 'warn', 'log', 'debug', 'verbose'],
  silent: [],
};

function resolveLoggerLevels(value?: string): LogLevel[] {
  return LOG_LEVELS[(value ?? 'log').toLowerCase()] ?? LOG_LEVELS.log;
}


async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: resolveLoggerLevels(process.env.LOG_LEVEL) });
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.setGlobalPrefix('api');
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('EMR API')
    .setDescription(
      'Electronic Medical Record: appointments, visits, encounters, dynamic forms, and clinical requests',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/api/docs', app, document);
  const yamlString = yaml.dump(document);
  fs.writeFileSync('./swagger.yml', yamlString);

  await app.listen(Number(configService.get<string>('PORT', '8093')));
}
bootstrap();
