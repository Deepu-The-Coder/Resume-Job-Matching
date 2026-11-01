import { BadRequestError } from '../lib/errors.js';

export function parseInput(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError('Invalid request input', result.error.flatten());
  }
  return result.data;
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new BadRequestError('Invalid request input', result.error.flatten()));
    }

    req[source] = result.data;
    return next();
  };
}

export default validate;
