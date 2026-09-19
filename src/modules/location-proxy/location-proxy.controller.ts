import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IdentityProxyService } from '../identity-proxy/identity-proxy.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('location-proxy')
@Controller('locations')
export class LocationProxyController {
  constructor(private readonly identityProxy: IdentityProxyService) {}

  @Get()
  @ApiOperation({
    summary: 'Search locations proxied from the identity service',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: 'Pharmacy',
    description: 'Search by location name or code',
  })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.identityProxy.searchLocations(
      { page, limit, search },
      user.organizationId ?? undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a location by id from the identity service' })
  async getById(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const location = await this.identityProxy.getLocationById(
      id,
      user.organizationId ?? undefined,
    );
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return location;
  }
}
