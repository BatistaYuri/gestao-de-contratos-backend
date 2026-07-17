import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { loginValidate, type LoginInput } from './auth.validate';
import { AuthService } from './auth.service';

export function createAuthRoutes(authService: AuthService): Router {
  const authRoutes = Router();

  authRoutes.post('/login', validate(loginValidate), async (request, response) => {
      response.json(await authService.login(request.body as LoginInput));
    },
  );

  return authRoutes;
}
