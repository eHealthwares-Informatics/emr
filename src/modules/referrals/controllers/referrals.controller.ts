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
import { ReferralsService } from '../services/referrals.service';
import {
  CompleteReferralDto,
  CreateReferralDto,
  DecideReferralDto,
} from '../dto/referral.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List referrals (direction=incoming|outgoing scoped to providerId, plus status/patient/encounter filters)',
  })
  async list(
    @Query()
    query: ListQueryDto & {
      status?: string;
      direction?: string;
      providerId?: string;
      patientId?: string;
      encounterId?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get referral by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({
    summary: 'Create an outgoing referral from an encounter',
  })
  create(
    @Body() dto: CreateReferralDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/decide')
  @ApiOperation({ summary: 'Accept or decline a pending referral' })
  decide(
    @Param('id') id: string,
    @Body() dto: DecideReferralDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.decide(id, dto, tenantFromUser(user), user);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete an accepted referral' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteReferralDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.complete(id, dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update referral notes/priority/status' })
  update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto as never, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a referral' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
