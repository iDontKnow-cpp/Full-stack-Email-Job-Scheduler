import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error: ZodError = result.error;
      const issues = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: issues,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
