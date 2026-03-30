import { Request } from 'express';
import AuditLog, { AuditStatus } from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';

type CreateAuditParams = {
  req: AuthRequest;
  action: string;
  entityType: string;
  entityId: any;
  entityName?: string;
  description: string;
  status?: AuditStatus;
  module?: string;
  subModule?: string;
  tags?: string[];
  details?: Record<string, unknown>;
};

export async function createAudit(params: CreateAuditParams) {
  const { req, action, entityType, entityId, entityName, description } = params;
  const status: AuditStatus = params.status || 'success';

  // If we ever log server-side events without an authenticated user,
  // we still want to avoid crashing. In practice, most logs here are admin/officer actions.
  if (!req.user) return;

  await AuditLog.create({
    action,
    entityType,
    entityId,
    entityName: entityName || '',
    user: req.user._id,
    userName: req.user.name,
    userEmail: req.user.email,
    userRole: req.user.role,
    ipAddress: (req as Request).ip || '',
    userAgent: (req.headers['user-agent'] as string) || '',
    description,
    status,
    module: params.module || '',
    subModule: params.subModule || '',
    tags: params.tags || [],
    details: params.details || {}
  });
}

