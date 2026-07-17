import zod from 'zod';

const dateOnly = zod
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Due date must be valid')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const contractParamsValidate = zod
  .object({ id: zod.uuid('Contract ID must be a UUID') })
  .strict();

export const createContractValidate = zod
  .object({
    number: zod.string().trim().min(1, 'Number is required'),
    clientId: zod.uuid('Client must be a UUID'),
    value: zod.number().positive('Value must be positive'),
    dueDate: dateOnly,
  })
  .strict();

export const updateContractValidate = createContractValidate;

export type ContractParams = zod.infer<typeof contractParamsValidate>;
export type CreateContractInput = zod.infer<typeof createContractValidate>;
export type UpdateContractInput = zod.infer<typeof updateContractValidate>;
