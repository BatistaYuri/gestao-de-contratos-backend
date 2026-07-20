import zod from 'zod';
import { paginationValidate } from '../../shared/pagination';

export const createClientValidate = zod
  .object({
    name: zod.string().trim().min(2, 'Name must contain at least 2 characters'),
    document: zod
      .string()
      .min(1, 'Document is required')
      .transform((document) => document.replace(/\D/g, ''))
      .refine((document) => document.length > 0, 'Document must contain numbers'),
  })
  .strict();

export const updateClientValidate = createClientValidate;

export const clientParamsValidate = zod
  .object({ id: zod.uuid('Client ID must be a UUID') })
  .strict();

export const listClientsValidate = zod.object(paginationValidate).strict();

export type CreateClientInput = zod.infer<typeof createClientValidate>;
export type UpdateClientInput = zod.infer<typeof updateClientValidate>;
export type ClientParams = zod.infer<typeof clientParamsValidate>;
export type ListClientsInput = zod.infer<typeof listClientsValidate>;
