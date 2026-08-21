import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FormAccessService } from '../services/form-access.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('forms')
@Controller('forms')
export class FormAccessController {
  constructor(private readonly formAccessService: FormAccessService) {}

  @Get('available')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List published forms the current user has access to' })
  available(@CurrentUser() user: RequestUser) {
    return this.formAccessService.getAvailableForms(user, tenantFromUser(user));
  }
}
