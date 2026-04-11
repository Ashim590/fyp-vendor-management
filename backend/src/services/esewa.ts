import crypto from 'crypto';
import axios from 'axios';

/** Avoid hammering eSewa when sandbox checkout is down (404). */
let sandboxCheckoutProbe: {
  url: string;
  expiresAt: number;
  lastStatus: number;
} | null = null;

const SANDBOX_CHECKOUT_PROBE_TTL_MS = 5 * 60 * 1000;

export type EsewaMode = 'sandbox' | 'production';

export type EsewaConfig = {
  mode: EsewaMode;
  productCode: string;
  secretKey: string;
  checkoutUrl: string;
  statusUrlBase: string;
  successUrl: string;
  failureUrl: string;
  clientReturnSuccessUrl: string;
  clientReturnFailureUrl: string;
};

export function getPublicBaseUrls(): {
  serverBaseUrl: string;
  clientBaseUrl: string;
} {
  const serverBaseUrl =
    process.env.BACKEND_URL ||
    process.env.SERVER_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  const clientBaseUrl =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_BASE_URL ||
    'http://localhost:5173';
  return { serverBaseUrl, clientBaseUrl };
}

/**
 * eSewa ePay v2 (developer.esewa.com.np — Epay-V2).
 * Sandbox checkout: docs use rc-epay; that path must be submitted as POST (GET → 404). In some regions or periods
 * rc-epay returns 404 on POST too (undeployed). Then set ESEWA_SANDBOX_CHECKOUT_URL to UAT if uat.esewa.com.np
 * resolves (common inside Nepal), or contact eSewa — EPAYTEST cannot use production epay.esewa.com.np.
 * Status (testing): Epay page lists https://rc.esewa.com.np/api/epay/transaction/status/
 * Override checkout/status with ESEWA_SANDBOX_CHECKOUT_URL / ESEWA_UAT_STATUS_URL_BASE.
 */
export function getEsewaConfig(): EsewaConfig {
  const mode =
    (process.env.ESEWA_MODE || 'sandbox').toLowerCase() === 'production'
      ? 'production'
      : 'sandbox';
  const isProd = mode === 'production';
  const sandboxProductCode = 'EPAYTEST';
  const sandboxSecretKey = '8gBm/:&EnhH.1/q';

  const { serverBaseUrl, clientBaseUrl } = getPublicBaseUrls();

  const successUrl =
    process.env.ESEWA_SUCCESS_URL ||
    `${serverBaseUrl}/api/v1/invoice-payment/esewa/success`;
  const failureUrl =
    process.env.ESEWA_FAILURE_URL ||
    `${serverBaseUrl}/api/v1/invoice-payment/esewa/failure`;

  return {
    mode,
    productCode: isProd ? process.env.ESEWA_PRODUCT_CODE || '' : sandboxProductCode,
    secretKey: isProd ? process.env.ESEWA_SECRET_KEY || '' : sandboxSecretKey,
    /** POST only — pasting this URL in the address bar (GET) usually returns 404. */
    checkoutUrl: isProd
      ? process.env.ESEWA_PROD_CHECKOUT_URL ||
        'https://epay.esewa.com.np/api/epay/main/v2/form'
      : process.env.ESEWA_SANDBOX_CHECKOUT_URL ||
        process.env.ESEWA_UAT_CHECKOUT_URL ||
        'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    /** If uat.esewa.com.np resolves for you, set ESEWA_UAT_STATUS_URL_BASE to the doc URL. */
    statusUrlBase: isProd
      ? process.env.ESEWA_PROD_STATUS_URL_BASE ||
        'https://epay.esewa.com.np/api/epay/transaction/status/'
      : process.env.ESEWA_UAT_STATUS_URL_BASE ||
        'https://rc.esewa.com.np/api/epay/transaction/status/',
    successUrl,
    failureUrl,
    clientReturnSuccessUrl:
      process.env.CLIENT_ESEWA_SUCCESS_RETURN_URL ||
      `${clientBaseUrl}/payments/esewa/success`,
    clientReturnFailureUrl:
      process.env.CLIENT_ESEWA_FAILURE_RETURN_URL ||
      `${clientBaseUrl}/payments/esewa/failure`,
  };
}

/**
 * In sandbox, POST a tiny invalid payload so we see HTTP 400/409 (gateway up) vs 404 (wrong host/path).
 * Cached a few minutes. Skip with ESEWA_SKIP_CHECKOUT_PROBE=1.
 */
export async function assertSandboxCheckoutReachable(checkoutUrl: string): Promise<void> {
  if (process.env.ESEWA_SKIP_CHECKOUT_PROBE === '1') return;

  const now = Date.now();
  if (
    sandboxCheckoutProbe &&
    sandboxCheckoutProbe.url === checkoutUrl &&
    now < sandboxCheckoutProbe.expiresAt
  ) {
    if (sandboxCheckoutProbe.lastStatus === 404) {
      throw new Error(sandboxCheckoutUnavailableMessage(checkoutUrl));
    }
    return;
  }

  const body =
    'amount=1&tax_amount=0&total_amount=1&transaction_uuid=probe-tx&product_code=EPAYTEST' +
    '&product_service_charge=0&product_delivery_charge=0' +
    '&success_url=http://127.0.0.1/s&failure_url=http://127.0.0.1/f' +
    '&signed_field_names=total_amount,transaction_uuid,product_code&signature=invalid';

  let status = 0;
  try {
    const res = await axios.post(checkoutUrl, body, {
      timeout: 4000,
      validateStatus: () => true,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    status = res.status;
  } catch {
    sandboxCheckoutProbe = {
      url: checkoutUrl,
      expiresAt: now + SANDBOX_CHECKOUT_PROBE_TTL_MS,
      lastStatus: 0,
    };
    return;
  }

  sandboxCheckoutProbe = {
    url: checkoutUrl,
    expiresAt: now + SANDBOX_CHECKOUT_PROBE_TTL_MS,
    lastStatus: status,
  };

  if (status === 404) {
    throw new Error(sandboxCheckoutUnavailableMessage(checkoutUrl));
  }
}

function sandboxCheckoutUnavailableMessage(checkoutUrl: string): string {
  return (
    `eSewa sandbox checkout returned HTTP 404 for ${checkoutUrl}. ` +
    `The official rc-epay path is sometimes offline. If you are in Nepal and uat.esewa.com.np resolves, set ` +
    `ESEWA_SANDBOX_CHECKOUT_URL=https://uat.esewa.com.np/api/epay/main/v2/form (and matching status base in docs), ` +
    `or set ESEWA_SKIP_CHECKOUT_PROBE=1 to bypass this check. Production EPAYTEST is not supported on epay.esewa.com.np.`
  );
}

/** eSewa HMAC-SHA256 signature (base64) for form fields listed in signed_field_names. */
export function signEsewaPayload(
  secretKey: string,
  payload: Record<string, string>,
  signedFieldNames: string,
): string {
  const message = signedFieldNames
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((field) => `${field}=${payload[field] ?? ''}`)
    .join(',');
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export function verifyEsewaCallbackSignature(
  secretKey: string,
  decoded: Record<string, unknown>,
): boolean {
  const signedFieldNames = String(decoded.signed_field_names || '').trim();
  if (!signedFieldNames) return false;
  const signature = String(decoded.signature || '').trim();
  if (!signature) return false;
  const strPayload: Record<string, string> = {};
  for (const [k, v] of Object.entries(decoded)) {
    strPayload[k] = v == null ? '' : String(v);
  }
  const expected = signEsewaPayload(secretKey, strPayload, signedFieldNames);
  return expected === signature;
}

export function decodeEsewaCallbackData(encoded: string): {
  decoded: Record<string, unknown>;
  decodedString: string;
} {
  const decodedString = Buffer.from(encoded, 'base64').toString('utf8');
  const decoded = JSON.parse(decodedString) as Record<string, unknown>;
  return { decoded, decodedString };
}

export async function checkEsewaTransactionStatus(args: {
  statusUrlBase: string;
  productCode: string;
  totalAmount: string;
  transactionUuid: string;
}): Promise<Record<string, unknown>> {
  const base = args.statusUrlBase.endsWith('/')
    ? args.statusUrlBase
    : `${args.statusUrlBase}/`;
  const url = new URL(base);
  url.searchParams.set('product_code', args.productCode);
  url.searchParams.set('total_amount', args.totalAmount);
  url.searchParams.set('transaction_uuid', args.transactionUuid);
  try {
    const res = await axios.get(url.toString(), { timeout: 15_000 });
    if (
      process.env.ESEWA_DEBUG === '1' ||
      process.env.NODE_ENV !== 'production'
    ) {
      console.log('[eSewa status]', {
        transaction_uuid: args.transactionUuid,
        data: res.data,
      });
    }
    return res.data as Record<string, unknown>;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (process.env.NODE_ENV === 'production') {
        console.error(
          '[eSewa status] error',
          e.message,
          e.response?.status,
        );
      } else {
        console.error(
          '[eSewa status] error',
          e.message,
          e.response?.status,
          e.response?.data,
        );
      }
    }
    throw e;
  }
}
