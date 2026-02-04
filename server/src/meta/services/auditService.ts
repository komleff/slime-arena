/**
 * Audit Service for admin actions logging
 *
 * Logs all admin actions to audit_log table for security tracking.
 * Required by REQ-MON-021, REQ-MON-045.
 */

import { getPostgresPool } from '../../db/pool';

export interface AuditLogEntry {
  id: number;
  userId: string | null;
  username?: string;
  action: string;
  target: string | null;
  ip: string | null;
  timestamp: Date;
  details: Record<string, unknown> | null;
}

export interface LogActionParams {
  userId: string | null;
  action: string;
  target?: string;
  ip?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an admin action to audit_log table
 *
 * @param params - Action parameters
 * @returns The created audit log entry ID
 */
export async function logAction(params: LogActionParams): Promise<number> {
  const pool = getPostgresPool();

  const { userId, action, target, ip, details } = params;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO audit_log (user_id, action, target, ip, details_json)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, action, target || null, ip || null, details ? JSON.stringify(details) : null]
  );

  const auditId = parseInt(result.rows[0].id, 10);
  console.log(`[Audit] ${action} by ${userId || 'system'} on ${target || 'n/a'} (id=${auditId})`);

  return auditId;
}

export interface GetAuditLogsParams {
  limit?: number;
  offset?: number;
  userId?: string;
  action?: string;
}

export interface GetAuditLogsResult {
  items: AuditLogEntry[];
  total: number;
}

/**
 * Get audit logs with pagination and filtering
 *
 * @param params - Query parameters
 * @returns Paginated audit log entries
 */
export async function getAuditLogs(params: GetAuditLogsParams): Promise<GetAuditLogsResult> {
  const pool = getPostgresPool();

  const { limit = 50, offset = 0, userId, action } = params;

  // Build WHERE clause dynamically
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (userId) {
    conditions.push(`al.user_id = $${paramIndex}`);
    values.push(userId);
    paramIndex++;
  }

  if (action) {
    conditions.push(`al.action = $${paramIndex}`);
    values.push(action);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM audit_log al ${whereClause}`;
  const countResult = await pool.query<{ total: string }>(countQuery, values);
  const total = parseInt(countResult.rows[0].total, 10);

  // Get items with join to admin_users for username
  const itemsQuery = `
    SELECT
      al.id,
      al.user_id as "userId",
      au.username,
      al.action,
      al.target,
      al.ip,
      al.timestamp,
      al.details_json as "details"
    FROM audit_log al
    LEFT JOIN admin_users au ON al.user_id = au.id
    ${whereClause}
    ORDER BY al.timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const itemsResult = await pool.query<{
    id: string;
    userId: string | null;
    username: string | null;
    action: string;
    target: string | null;
    ip: string | null;
    timestamp: Date;
    details: Record<string, unknown> | null;
  }>(itemsQuery, [...values, Math.min(limit, 100), offset]);

  const items: AuditLogEntry[] = itemsResult.rows.map((row) => ({
    id: parseInt(row.id, 10),
    userId: row.userId,
    username: row.username || undefined,
    action: row.action,
    target: row.target,
    ip: row.ip,
    timestamp: row.timestamp,
    details: row.details,
  }));

  return { items, total };
}
