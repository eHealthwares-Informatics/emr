import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentProvidersService } from '../services/payment-providers.service';
import {
  CreatePaymentProviderDto,
  UpdatePaymentProviderDto,
} from '../dto/payment-provider.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('payment-providers')
@Controller('payment-providers')
export class PaymentProvidersController {
  constructor(private readonly service: PaymentProvidersService) {}

  @Get()
  @ApiOperation({
    summary: 'List payment providers with pagination and search',
  })
  async list(@Query() query: ListQueryDto, @CurrentUser() user: RequestUser) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment provider by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a payment provider' })
  create(
    @Body() dto: CreatePaymentProviderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(dto, tenantFromUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a payment provider' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentProviderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a payment provider' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
