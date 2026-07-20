import zod from 'zod';

export const paginationValidate = {
  page: zod.coerce.number().int().min(1).default(1),
  pageSize: zod.coerce.number().int().min(1).max(100).default(20),
};

export type PaginationInput = {
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function paginate<T>(data: T[], total: number, input: PaginationInput): PaginatedResult<T> {
  return {
    data,
    pagination: {
      ...input,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
  };
}
