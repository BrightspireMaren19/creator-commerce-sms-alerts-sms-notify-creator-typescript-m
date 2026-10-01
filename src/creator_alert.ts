import { z } from "zod";

import { infrai, type SmsReceipt } from "./infrai_sms.js";

const baseEvent = {
  eventId: z.string().min(1),
  creatorId: z.string().min(1),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "phone must use E.164 format"),
};

export const alertEventSchema = z.discriminatedUnion("kind", [
  z.object({
    ...baseEvent,
    kind: z.literal("digital_asset"),
    status: z.enum(["processing", "ready"]),
    orderNumber: z.string().min(1),
    assetName: z.string().min(1),
  }),
  z.object({
    ...baseEvent,
    kind: z.literal("subscriber_update"),
    status: z.enum(["active", "paused"]),
    subscriberName: z.string().min(1),
  }),
  z.object({
    ...baseEvent,
    kind: z.literal("content_processing"),
    status: z.enum(["started", "completed", "needs_attention"]),
    contentTitle: z.string().min(1),
  }),
]);

export type AlertEvent = z.infer<typeof alertEventSchema>;

export type AlertDecision =
  | { action: "skip"; reason: string }
  | { action: "send"; body: string };

export function decideCreatorAlert(event: AlertEvent): AlertDecision {
  if (event.kind === "digital_asset") {
    if (event.status !== "ready") return { action: "skip", reason: "asset is still processing" };
    return {
      action: "send",
      body: `Order ${event.orderNumber}: ${event.assetName} is ready for delivery. Open your storefront dashboard to review it.`,
    };
  }

  if (event.kind === "subscriber_update") {
    if (event.status !== "paused") return { action: "skip", reason: "active subscription needs no alert" };
    return {
      action: "send",
      body: `${event.subscriberName}'s subscription is paused. Review the subscriber record in your storefront dashboard.`,
    };
  }

  if (event.status !== "needs_attention") {
    return { action: "skip", reason: "content processing is on track" };
  }
  return {
    action: "send",
    body: `Content processing needs attention: ${event.contentTitle}. Open your storefront dashboard for details.`,
  };
}

type SendSms = typeof infrai.sms.send;

export async function processCreatorEvent(
  event: AlertEvent,
  sendSms: SendSms = infrai.sms.send,
): Promise<{ outcome: "skipped"; reason: string } | { outcome: "sent"; message_id: string }> {
  const decision = decideCreatorAlert(event);
  if (decision.action === "skip") return { outcome: "skipped", reason: decision.reason };

  const receipt: SmsReceipt = await sendSms({
    to: event.phone,
    body: decision.body,
    idempotency_key: `creator-alert:${event.creatorId}:${event.eventId}`,
  });
  return { outcome: "sent", message_id: receipt.message_id };
}
