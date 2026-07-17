import { AppError } from '../../erros/app-error';
import type { LoginInput } from './auth.validate';

export interface AuthConfig {
  username: string;
  password: string;
  jwtExpiresIn: string;
  jwtSecret: string;
}

export class AuthService {
  private readonly secret: Uint8Array;

  constructor(private readonly config: AuthConfig) {
    this.secret = new TextEncoder().encode(config.jwtSecret);
  }

  async login(credentials: LoginInput): Promise<{ token: string }> {
    if (
      credentials.username !== this.config.username ||
      credentials.password !== this.config.password
    ) {
      throw new AppError('Invalid credentials', 401);
    }

    const { SignJWT } = await import('jose');
    const token = await new SignJWT({ username: this.config.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(this.config.username)
      .setIssuedAt()
      .setExpirationTime(this.config.jwtExpiresIn)
      .sign(this.secret);

    return { token };
  }

  async verify(token: string): Promise<void> {
    try {
      const { jwtVerify } = await import('jose');
      await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  }
}
