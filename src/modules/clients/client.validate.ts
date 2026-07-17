import zod from 'zod';

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

export type CreateClientInput = zod.infer<typeof createClientValidate>;
