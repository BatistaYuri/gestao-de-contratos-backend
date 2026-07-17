import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { AuthService, type AuthConfig } from '../../../src/modules/auth/auth.service';

const config: AuthConfig = {
  username: 'admin321',
  password: 'admin123',
  jwtExpiresIn: '8h',
  jwtSecret: 'test-secret',
};

describe('AuthService', () => {
  it('logs in with valid credentials and issues a valid token', async () => {
    const service = new AuthService(config);
    const result = await service.login({
      username: config.username,
      password: config.password,
    });

    await expect(service.verify(result.token)).resolves.toBeUndefined();
    expect(decodeJwt(result.token)).toMatchObject({
      username: config.username,
      sub: config.username,
    });
  });

  it('rejects invalid credentials', async () => {
    const service = new AuthService(config);

    await expect(
      service.login({ username: config.username, password: 'wrong-password' }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a token signed with another secret', async () => {
    const issuer = new AuthService({ ...config, jwtSecret: 'another-secret' });
    const service = new AuthService(config);
    const { token } = await issuer.login({
      username: config.username,
      password: config.password,
    });

    await expect(service.verify(token)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
