import { Router } from 'express';
import { PrismaClientRepository } from './client.repository';
import { createClientValidate, type CreateClientInput } from './client.validate';
import { ClientService } from './client.service';
import { validate } from '../../middleware/validate';

export const clientRoutes = Router();
const clientRepository = new PrismaClientRepository();
const clientService = new ClientService(clientRepository);

clientRoutes.post('/', validate(createClientValidate), async (request, response) => {
    const client = await clientService.create(request.body as CreateClientInput);
    response.status(201).json(client);
  },
);

clientRoutes.get('/', async (_request, response) => {
  const clients = await clientService.list();
  response.json(clients);
});
