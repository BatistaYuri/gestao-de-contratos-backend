import zod from 'zod';

export const loginValidate = zod
  .object({
    username: zod.string().min(8),
    password: zod.string().min(1),
  })
  .strict();

export type LoginInput = zod.infer<typeof loginValidate>;
