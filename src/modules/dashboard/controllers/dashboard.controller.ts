import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Daily operational summary for the EMR dashboard' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'YYYY-MM-DD; defaults to today',
  })
  summary(
    @Query('date') date: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const today = date ?? new Date().toISOString().slice(0, 10);
    return this.dashboardService.summary(tenantFromUser(user), today);
  }

  @Get('attended-patients')
  @ApiOperation({
    summary:
      'Distinct patients ever attended (visit or encounter), optionally scoped to a provider',
  })
  attendedPatients(
    @Query('providerId') providerId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dashboardService
      .attendedPatientCount(tenantFromUser(user), providerId)
      .then((count) => ({ count }));
  }
}
