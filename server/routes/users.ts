import { RequestHandler, Router } from 'express';
import { jsonError } from '../utils/httpHelpers';
import { ensureConnection, findUserById } from '../utils/database';
import { generateToken } from '../utils/auth';
import { computeFingerprint, getClientIp, getGeo, logSecurityEvent, parseCookie } from '../utils/security';

export const usersRouter = Router();

const isValidEmail = (email: string): boolean => {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getMyProfile: RequestHandler = async (req, res) => {
	try {
		const userId = (req.user as any)?.id;
		if (!userId) return jsonError(res, 401, 'Not authenticated');

		const pool = await ensureConnection();
		const user = await findUserById(String(userId));
		if (!user) return jsonError(res, 404, 'User not found');

		// Subscription summary (optional)
		const sub = await pool.query(
			`SELECT tier, status, trial_started_at, trial_ends_at, current_period_start, current_period_end
			 FROM subscriptions
			 WHERE user_id = $1
			 LIMIT 1`,
			[userId]
		);

		// Get store_name from client_store_settings (synced with business_name)
		const storeSettings = await pool.query(
			`SELECT store_name FROM client_store_settings WHERE client_id = $1 LIMIT 1`,
			[userId]
		);
		const storeName = storeSettings.rows[0]?.store_name || null;

		return res.json({
			id: String(user.id),
			email: user.email,
			name: user.name,
			role: user.role,
			user_type: (user as any).user_type || null,
			is_locked: !!(user as any).is_locked,
			locked_reason: (user as any).locked_reason || null,
			lock_type: (user as any).lock_type || null,
			phone: (user as any).phone || null,
			business_name: storeName || (user as any).business_name || null,
			country: (user as any).country || null,
			city: (user as any).city || null,
			subscription: sub.rows[0] || null,
		});
	} catch (error) {
		console.error('Error getting profile:', error);
		return jsonError(res, 500, 'Failed to get profile');
	}
};

const updateMyProfile: RequestHandler = async (req, res) => {
	try {
		const userId = (req.user as any)?.id;
		if (!userId) return jsonError(res, 401, 'Not authenticated');

		const { name, email, phone, business_name, country, city } = req.body || {};

		const updates: Record<string, string> = {};
		if (typeof name === 'string') updates.name = name.trim();
		if (typeof phone === 'string') updates.phone = phone.trim();
		if (typeof business_name === 'string') updates.business_name = business_name.trim();
		if (typeof country === 'string') updates.country = country.trim();
		if (typeof city === 'string') updates.city = city.trim();

		if (typeof email === 'string') {
			const normalized = email.trim().toLowerCase();
			if (!isValidEmail(normalized)) return jsonError(res, 400, 'Invalid email');
			updates.email = normalized;
		}

		if (Object.keys(updates).length === 0) {
			return jsonError(res, 400, 'No updates provided');
		}

		const pool = await ensureConnection();
		const existing = await findUserById(String(userId));
		if (!existing) return jsonError(res, 404, 'User not found');

		// Email uniqueness across clients + admins
		if (updates.email && updates.email !== existing.email) {
			const emailInClients = await pool.query(
				'SELECT 1 FROM clients WHERE email = $1 AND id <> $2 LIMIT 1',
				[updates.email, userId]
			);
			if (emailInClients.rowCount) return jsonError(res, 409, 'Email already in use');

			const emailInAdmins = await pool.query('SELECT 1 FROM admins WHERE email = $1 LIMIT 1', [updates.email]);
			if (emailInAdmins.rowCount) return jsonError(res, 409, 'Email already in use');
		}

		const result = await pool.query(
			`UPDATE clients
			 SET
				 name = COALESCE($1, name),
				 email = COALESCE($2, email),
				 phone = COALESCE($3, phone),
				 business_name = COALESCE($4, business_name),
				 country = COALESCE($5, country),
				 city = COALESCE($6, city),
				 updated_at = NOW()
			 WHERE id = $7
			 RETURNING id, email, name, role, user_type, is_locked, locked_reason, lock_type, phone, business_name, country, city`,
			[
				updates.name ?? null,
				updates.email ?? null,
				updates.phone ?? null,
				updates.business_name ?? null,
				updates.country ?? null,
				updates.city ?? null,
				userId,
			]
		);

		if (!result.rows.length) return jsonError(res, 404, 'User not found');
		const updated = result.rows[0];

		// Sync business_name to store_name in client_store_settings
		if (updates.business_name) {
			await pool.query(
				`UPDATE client_store_settings
				 SET store_name = $1, updated_at = NOW()
				 WHERE client_id = $2`,
				[updates.business_name, userId]
			);
		}

		const token = generateToken({
			id: String(updated.id),
			email: updated.email,
			role: (updated.role as any) || 'user',
			user_type: (updated.user_type as any) || (updated.role === 'admin' ? 'admin' : 'client'),
		});

		try {
			const ip = getClientIp(req as any);
			const ua = (req.headers['user-agent'] as string | undefined) || null;
			const geo = getGeo(req as any, ip);
			const fpCookie = parseCookie(req as any, 'ecopro_fp');
			const fingerprint = computeFingerprint({ ip, userAgent: ua, cookie: fpCookie });
			await logSecurityEvent({
				event_type: 'user_profile_updated',
				severity: 'info',
				request_id: (req as any).requestId || null,
				method: req.method,
				path: req.path,
				status_code: 200,
				ip,
				user_agent: ua,
				fingerprint,
				country_code: geo.country_code,
				region: geo.region,
				city: geo.city,
				user_id: String(updated.id),
				user_type: updated.user_type || null,
				role: updated.role || null,
				metadata: {
					scope: 'profile',
					changed_fields: Object.keys(updates),
				},
			});
		} catch {
			// ignore
		}

		return res.json({
			message: 'Profile updated',
			token,
			user: {
				id: String(updated.id),
				email: updated.email,
				name: updated.name,
				role: updated.role,
				user_type: updated.user_type,
				is_locked: !!updated.is_locked,
				locked_reason: updated.locked_reason || null,
				lock_type: updated.lock_type || null,
				phone: updated.phone || null,
				business_name: updated.business_name || null,
				country: updated.country || null,
				city: updated.city || null,
			},
		});
	} catch (error) {
		console.error('Error updating profile:', error);
		return jsonError(res, 500, 'Failed to update profile');
	}
};

usersRouter.get('/me', getMyProfile);
usersRouter.put('/me', updateMyProfile);
