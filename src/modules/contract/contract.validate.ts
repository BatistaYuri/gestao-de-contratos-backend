import { ApprovalStatus, ContractStatus, ContractType, Prisma } from '@prisma/client';
import zod from 'zod';
import { paginationValidate } from '../../shared/pagination';

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

const positiveQuantity = zod.string()
  .regex(/^\d+(\.\d{1,3})?$/, 'Quantity must be a positive decimal with at most 3 decimal places')
  .refine((value) => new Prisma.Decimal(value).greaterThan(0), 'Quantity must be greater than zero');

const contractItem = zod.object({
  description: zod.string().trim().min(1, 'Item description is required'),
  quantity: positiveQuantity,
  unitPrice: nonNegativeDecimal,
}).strict();

export const contractParamsValidate = zod
  .object({ id: zod.uuid('Contract ID must be a UUID') })
  .strict();

export const createContractValidate = zod
  .object({
    number: zod.string().trim().min(1, 'Number is required'),
    clientId: zod.uuid('Client must be a UUID'),
    type: zod.enum(ContractType),
    dueDate: dateOnly,
    currency: zod.literal('BRL').default('BRL'),
    discount: nonNegativeDecimal.default('0'),
    additionalFees: nonNegativeDecimal.default('0'),
    items: zod.array(contractItem).min(1, 'Contract must have at least one item'),
  })
  .strict()
  .refine(
    ({ items, discount, additionalFees }) => items.reduce(
      (subtotal, item) => subtotal.plus(new Prisma.Decimal(item.quantity).times(item.unitPrice)),
      new Prisma.Decimal(0),
    ).toDecimalPlaces(2).minus(discount).plus(additionalFees).greaterThanOrEqualTo(0),
    { message: 'Contract total cannot be negative' },
  );

export const updateContractValidate = createContractValidate;

export const rejectContractValidate = zod.object({
  reason: zod.string().trim().min(1, 'Rejection reason is required'),
}).strict();

export const contractFiltersValidate = zod.object({
  status: zod.enum(ContractStatus).optional(),
  type: zod.enum(ContractType).optional(),
  approvalStatus: zod.enum(ApprovalStatus).optional(),
  clientId: zod.uuid('Client must be a UUID').optional(),
}).strict();

export const listContractsValidate = contractFiltersValidate.extend(paginationValidate);

export type ContractParams = zod.infer<typeof contractParamsValidate>;
export type CreateContractInput = zod.infer<typeof createContractValidate>;
export type UpdateContractInput = zod.infer<typeof updateContractValidate>;
export type RejectContractInput = zod.infer<typeof rejectContractValidate>;
export type ListContractsInput = zod.infer<typeof listContractsValidate>;
export type ContractFiltersInput = zod.infer<typeof contractFiltersValidate>;
