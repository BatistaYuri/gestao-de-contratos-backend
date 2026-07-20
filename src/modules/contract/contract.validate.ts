import { ApprovalStatus, ContractStatus, ContractType, Prisma } from '@prisma/client';
import zod from 'zod';

const dateOnly = zod
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Due date must be valid')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const nonNegativeDecimal = zod
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Value must be a non-negative decimal with at most 2 decimal places');

export const contractParamsValidate = zod
  .object({ id: zod.uuid('Contract ID must be a UUID') })
  .strict();

export const createContractValidate = zod
  .object({
    number: zod.string().trim().min(1, 'Number is required'),
    clientId: zod.uuid('Client must be a UUID'),
    value: zod.number().positive('Value must be positive'),
    type: zod.enum(ContractType),
    dueDate: dateOnly,
    currency: zod.literal('BRL').default('BRL'),
    discount: nonNegativeDecimal.default('0'),
    additionalFees: nonNegativeDecimal.default('0'),
  })
  .strict()
  .refine(
    ({ value, discount, additionalFees }) => new Prisma.Decimal(value)
      .minus(discount)
      .plus(additionalFees)
      .isPositive() || new Prisma.Decimal(value).minus(discount).plus(additionalFees).isZero(),
    { message: 'Contract total cannot be negative' },
  );

export const updateContractValidate = createContractValidate;

export const rejectContractValidate = zod.object({
  reason: zod.string().trim().min(1, 'Rejection reason is required'),
}).strict();

export const listContractsValidate = zod.object({
  status: zod.enum(ContractStatus).optional(),
  type: zod.enum(ContractType).optional(),
  approvalStatus: zod.enum(ApprovalStatus).optional(),
  clientId: zod.uuid('Client must be a UUID').optional(),
}).strict();

export type ContractParams = zod.infer<typeof contractParamsValidate>;
export type CreateContractInput = zod.infer<typeof createContractValidate>;
export type UpdateContractInput = zod.infer<typeof updateContractValidate>;
export type RejectContractInput = zod.infer<typeof rejectContractValidate>;
export type ListContractsInput = zod.infer<typeof listContractsValidate>;
