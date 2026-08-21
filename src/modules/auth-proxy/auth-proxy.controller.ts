import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthProxyService, ProxyAuthResponse, ProxyMeResponse } from './auth-proxy.service';

class ProxyLoginDto {
  @ApiProperty({ example: 'admin', description: 'Username' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'password', description: 'Password (min 6 characters)' })
  @IsString()
  @MinLength(6)
  password!: string;
}

class ProxyRefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

class ProxyAuthResponseDto implements ProxyAuthResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() accessTokenExpiresIn!: number;
  @ApiProperty() refreshTokenExpiresIn!: number;
}

class ProxyModuleDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() root!: string;
}

class ProxyMeResponseDto implements ProxyMeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() roles!: string[];
  @ApiProperty() permissions!: string[];
  @ApiProperty({ type: () => [ProxyModuleDto] }) modules!: ProxyModuleDto[];
}

@ApiTags('auth-proxy')
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly authProxy: AuthProxyService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate via the identity service and return tokens' })
  login(@Body() payload: ProxyLoginDto): Promise<ProxyAuthResponse> {
    return this.authProxy.login(payload);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token through the identity service' })
  refreshToken(@Body() payload: ProxyRefreshTokenDto): Promise<ProxyAuthResponse> {
    return this.authProxy.refreshToken(payload);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the presented refresh token (sign out this device)' })
  logout(@Body() payload: ProxyRefreshTokenDto): Promise<void> {
    return this.authProxy.logout(payload);
  }

  @Public()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all refresh tokens for the user' })
  logoutAll(
    @Headers('authorization') authHeader: string | undefined,
    @Body() payload: ProxyRefreshTokenDto,
  ): Promise<void> {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return this.authProxy.logoutAll(payload, token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with modules from the identity service' })
  me(@Headers('authorization') authHeader: string | undefined): Promise<ProxyMeResponseDto> {
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return this.authProxy.me(token);
  }
}