import { RequestHandler } from 'express';
import { z } from 'zod';

const emailSchema = z
	.string({ required_error: 'Email is required' })
	.trim()
	.toLowerCase()
	.email('Invalid email');

const passwordSchema = z
	.string({ required_error: 'Password is required' })
	.min(1, 'Password is required');

export const registerBodySchema = z
	.object({
		email: emailSchema,
		password: passwordSchema,
		name: z.string().trim().min(1).max(200).optional(),
		store_name: z.string().trim().max(200).optional(),
		role: z.enum(['client', 'seller', 'admin']).optional(),
		voucher_code: z.string().trim().max(50).optional(),
	})
	.strict();

export const loginBodySchema = z
	.object({
		email: emailSchema,
		password: passwordSchema,
		totp_code: z.string().trim().optional(),
		backup_code: z.string().trim().optional(),
	})
	.strict();

function validateBody(schema: z.ZodTypeAny): RequestHandler {
	return (req, res, next) => {
		const parsed = schema.safeParse(req.body);
		if (!parsed.success) {
			const msg = parsed.error.errors?.[0]?.message || 'Invalid request';
			return res.status(400).json({ error: msg });
		}
		req.body = parsed.data;
		next();
	};
}

// Strict input validation (reject unknown fields)
export const registerValidation: RequestHandler = validateBody(registerBodySchema);
export const loginValidation: RequestHandler = validateBody(loginBodySchema);

// Backward-compatible hook (kept for existing route chains)
export const validate: RequestHandler = (_req, _res, next) => next();

export default {};
