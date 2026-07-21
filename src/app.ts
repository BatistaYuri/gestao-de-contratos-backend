import express from 'express';
import { clientRoutes } from './modules/clients/client.controller';
import { errorHandler } from './middleware/error-handler';
import { contractRoutes } from './modules/contract/contract.controller';
import { createAuthenticate } from './middleware/authenticate';
import { AuthService } from './modules/auth/auth.service';
import { env } from './config/env';
import { createAuthRoutes } from './modules/auth/auth.controller';

export const app = express();

app.use((req, res, next) => {
  const requestOrigin = req.header('Origin');

  if (requestOrigin === env.corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(requestOrigin === env.corsOrigin ? 204 : 403);
    return;
  }

  next();
});

app.use(express.json());

app.get('/api/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
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
