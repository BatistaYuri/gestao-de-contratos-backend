import { Router } from 'express';

import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { PrismaContractRepository } from './contract.repository';
import { ContractService } from './contract.service';
import {
  contractParamsValidate,
  createContractValidate,
  type ContractParams,
  type CreateContractInput,
  type UpdateContractInput,
  updateContractValidate,
  listContractsValidate,
  rejectContractValidate,
  type ListContractsInput,
  type RejectContractInput,
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

contractRoutes.get('/', validateQuery(listContractsValidate), async (request, response) => {
  response.json(await contractService.list(request.query as ListContractsInput));
});

contractRoutes.get('/summary', validateQuery(listContractsValidate), async (request, response) => {
  response.json(await contractService.summary(request.query as ListContractsInput));
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

contractRoutes.get('/:id/approval-history', validateParams(contractParamsValidate), async (request, response) => {
  response.json(await contractService.approvalHistory((request.params as ContractParams).id));
});

contractRoutes.patch('/:id/submit', validateParams(contractParamsValidate), async (request, response) => {
  response.json(await contractService.submit((request.params as ContractParams).id));
});

contractRoutes.patch('/:id/approve', validateParams(contractParamsValidate), async (request, response) => {
  response.json(await contractService.approve((request.params as ContractParams).id));
});

contractRoutes.patch('/:id/reject', validateParams(contractParamsValidate), validate(rejectContractValidate), async (request, response) => {
  response.json(await contractService.reject(
    (request.params as ContractParams).id,
    (request.body as RejectContractInput).reason,
  ));
});

