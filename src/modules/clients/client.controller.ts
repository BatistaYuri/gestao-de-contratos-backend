import { Router } from 'express';
import { PrismaClientRepository } from './client.repository';
import { createClientValidate, type CreateClientInput } from './client.validate';
import { ClientService } from './client.service';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import {
  clientParamsValidate,
  type ClientParams,
  listClientsValidate,
  updateClientValidate,
  type UpdateClientInput,
} from './client.validate';

export const clientRoutes = Router();
const clientRepository = new PrismaClientRepository();
const clientService = new ClientService(clientRepository);

clientRoutes.post('/', validate(createClientValidate), async (request, response) => {
    const client = await clientService.create(request.body as CreateClientInput);
    response.status(201).json(client);
  },
);

clientRoutes.get('/', validateQuery(listClientsValidate), async (request, response) => {
  const clients = await clientService.list(listClientsValidate.parse(request.query));
  response.json(clients);
});

clientRoutes.get('/:id', validateParams(clientParamsValidate), async (request, response) => {
  response.json(await clientService.getById((request.params as ClientParams).id));
});

clientRoutes.put('/:id', validateParams(clientParamsValidate), validate(updateClientValidate), async (request, response) => {
  response.json(await clientService.update(
    (request.params as ClientParams).id,
    request.body as UpdateClientInput,
  ));
});

clientRoutes.delete('/:id', validateParams(clientParamsValidate), async (request, response) => {
  await clientService.delete((request.params as ClientParams).id);
  response.status(204).send();
});
