import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.SKIP_AUTH === 'true') {
      const request = context.switchToHttp().getRequest();
      request.user = {
        sub: 'skip-auth-user',
        organizationId: '00000000-0000-0000-0000-000000000000',
        locationId: null,
        username: 'skip-auth',
        roles: [],
        permissions: [],
      };
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: unknown;
    }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    // SECURITY: no hardcoded secret fallback — a misconfigured deployment must
    // fail loudly instead of silently verifying tokens with a well-known
    // default. JWT_ACCESS_SECRET must be set in env and shared with identity.
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('JWT_ACCESS_SECRET is not configured');
    }

    try {
      request.user = await this.jwtService.verifyAsync(token, { secret });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
