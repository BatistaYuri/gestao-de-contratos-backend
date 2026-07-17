import express from 'express';
import { clientRoutes } from './modules/clients/client.controller';
import { errorHandler } from './middleware/error-handler';
import { contractRoutes } from './modules/contract/contract.controller';
import { createAuthenticate } from './middleware/authenticate';
import { AuthService } from './modules/auth/auth.service';
import { env } from './config/env';
import { createAuthRoutes } from './modules/auth/auth.controller';

export const app = express();
app.use(express.json());

app.get('/', (_, res) => {
  res.send('Hello, World!');
});

const authService = new AuthService({
  username: env.adminUsername,
  password: env.adminPassword,
  jwtExpiresIn: env.jwtExpiresIn,
  jwtSecret: env.jwtSecret,
});

app.use('/api/auth', createAuthRoutes(authService));
app.use('/api/clients', createAuthenticate(authService), clientRoutes);
app.use('/api/contracts', createAuthenticate(authService), contractRoutes);
app.use(errorHandler);