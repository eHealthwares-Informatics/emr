import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { permissionMatches } from '../utils/permission-matcher';

type UserWithPermissions = { permissions?: string[] };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: UserWithPermissions }>();
    const userPerms = request.user?.permissions ?? [];

    const isAllowed = requiredPermissions.some((required) =>
      userPerms.some((userPerm) => permissionMatches(userPerm, required)),
    );

    if (!isAllowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
