import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validate(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    request.body = schema.parse(request.body);
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    request.params = schema.parse(request.params) as typeof request.params;
    next();
  };
}
