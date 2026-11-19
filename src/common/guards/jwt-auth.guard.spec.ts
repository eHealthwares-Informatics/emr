import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * The guard is the single place a JWT payload becomes `request.user`, so it is
 * where blank tenant claims must be normalised — every controller, decorator and
 * `tenantFromUser()` downstream relies on it.
 */
describe('JwtAuthGuard tenant normalisation', () => {
  function contextFor(authorization: string | undefined) {
    const request: any = { headers: authorization ? { authorization } : {} };
    return {
      request,
      ctx: {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any,
    };
  }

  function makeGuard(payload: any) {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(payload),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_ACCESS_SECRET' ? 'secret' : undefined,
      ),
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    return new JwtAuthGuard(jwtService as any, configService as any, reflector as any);
  }

  it('turns a blank organizationId from the token into null', async () => {
    const { request, ctx } = contextFor('Bearer token');
    const guard = makeGuard({
      sub: '1601624e-93e5-43a0-b122-247a5dcf2c62',
      organizationId: '',
      locationId: null,
      username: 'super_admin',
      roles: ['super_admin'],
      permissions: [],
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(request.user.organizationId).toBeNull();
    expect(request.user.locationId).toBeNull();
    // Everything else from the token is preserved.
    expect(request.user.sub).toBe('1601624e-93e5-43a0-b122-247a5dcf2c62');
    expect(request.user.roles).toEqual(['super_admin']);
  });

  it('keeps a real organizationId untouched', async () => {
    const { request, ctx } = contextFor('Bearer token');
    const guard = makeGuard({
      sub: 'u1',
      organizationId: '60203e1c1ec8a00015baa357',
      locationId: 'loc-1',
    });

    await guard.canActivate(ctx);

    expect(request.user.organizationId).toBe('60203e1c1ec8a00015baa357');
    expect(request.user.locationId).toBe('loc-1');
  });
});
