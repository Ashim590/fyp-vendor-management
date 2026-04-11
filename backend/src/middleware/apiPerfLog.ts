import type { RequestHandler, Response } from 'express';
import { isApiPerfLoggingEnabled } from '../config/runtimeFlags';
import { perfLabel } from '../utils/perfTiming';

/**
 * When API_PERF_LOG=1: logs wall time and JSON payload size for res.json() responses.
 * In production, also set API_PERF_IN_PRODUCTION=1 or this middleware stays off.
 */
export const apiPerfLogMiddleware: RequestHandler = (req, res, next) => {
  const on = isApiPerfLoggingEnabled();
  if (!on) {
    next();
    return;
  }

  const path = (req.originalUrl || req.url || '').split('?')[0];
  const label = perfLabel(`${req.method} ${path}`);
  console.time(label);
  const startNs = process.hrtime.bigint();

  const r = res as Response & { __apiPerfJsonBytes?: number };
  const origJson = res.json.bind(res);
  res.json = function jsonPatched(body: unknown) {
    try {
      r.__apiPerfJsonBytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
    } catch {
      r.__apiPerfJsonBytes = undefined;
    }
    return origJson(body);
  };

  res.on('finish', () => {
    console.timeEnd(label);
    const slowMs = parseInt(process.env.API_SLOW_REQUEST_MS || '0', 10);
    if (slowMs > 0) {
      const ms = Number(process.hrtime.bigint() - startNs) / 1e6;
      if (ms >= slowMs) {
        console.warn(
          `[API_SLOW] ${req.method} ${path} ${ms.toFixed(0)}ms status=${res.statusCode}`,
        );
      }
    }
    if (r.__apiPerfJsonBytes != null) {
      console.log(
        `[API_PERF] ${req.method} ${path} status=${res.statusCode} jsonBytes≈${r.__apiPerfJsonBytes}`,
      );
    } else {
      console.log(
        `[API_PERF] ${req.method} ${path} status=${res.statusCode} (non-json or empty body)`,
      );
    }
  });

  next();
};
