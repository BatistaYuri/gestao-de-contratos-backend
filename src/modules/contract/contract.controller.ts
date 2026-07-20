import { Router } from 'express';

import { validate, validateParams } from '../../middleware/validate';
import { PrismaContractRepository } from './contract.repository';
import { ContractService } from './contract.service';
import {
  contractParamsValidate,
  createContractValidate,
  type ContractParams,
  type CreateContractInput,
  type UpdateContractInput,
  updateContractValidate,
} from './contract.validate';
import { RedisContractSummaryCache } from '../../infra/redis/contract-summary-cache';
import { ensureRedisConnection } from '../../infra/redis/redis-client';
import { env } from '../../config/env';
import { PrismaClientRepository } from '../clients/client.repository';

const contractSummaryCache = new RedisContractSummaryCache(ensureRedisConnection, env.contractSummaryCacheTtlSeconds);
const contractService = new ContractService(
  new PrismaContractRepository(),
  new PrismaClientRepository(),
  contractSummaryCache,
);

export const contractRoutes = Router();

contractRoutes.post('/', validate(createContractValidate), async (request, response) => {
    const contract = await contractService.create(request.body as CreateContractInput);
    response.status(201).json(contract);
  },
);

contractRoutes.get('/', async (_, response) => {
  response.json(await contractService.list());
});

contractRoutes.get('/summary', async (_, response) => {
  response.json(await contractService.summary());
});

contractRoutes.get('/:id', validateParams(contractParamsValidate), async (request, response) => {
    response.json(
      await contractService.getById((request.params as ContractParams).id),
    );
  },
);

contractRoutes.put('/:id', validateParams(contractParamsValidate), validate(updateContractValidate), async (request, response) => {
    response.json(
      await contractService.update((request.params as ContractParams).id,request.body as UpdateContractInput),
    );
  },
);

contractRoutes.delete('/:id', validateParams(contractParamsValidate), async (request, response) => {
    await contractService.delete((request.params as ContractParams).id);
    response.status(204).send();
  },
);

contractRoutes.patch('/:id/close', validateParams(contractParamsValidate), async (request, response) => {
    response.json(
      await contractService.close((request.params as ContractParams).id),
    );
  },
);

