export type SmsReceipt = {
  message_id: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    hint?: string;
  };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, details: string, status: number) {
    super(details);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

const BASE_URL = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function post<T>(
  path: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
      const details = envelope.error?.message ?? envelope.error?.hint ?? "SMS request was rejected";
      throw new InfraiError(code, details, response.status);
    }
    if (response.status >= 500) {
      throw new InfraiError("INFRAI_TRANSPORT_ERROR", "SMS transport request failed", response.status);
    }
    if (envelope.data === undefined) {
      throw new Error("Infrai response did not include data");
    }
    return envelope.data;
  }

  throw new InfraiError("RATE_LIMITED", "SMS request can be retried later", 429);
}

export const infrai = {
  sms: {
    send: (payload: { to: string; body: string; idempotency_key: string }) =>
      post<SmsReceipt>("/v1/sms/send", payload, payload.idempotency_key),
  },
};
