import assert from "node:assert/strict";
import test from "node:test";

import { alertEventSchema, decideCreatorAlert, processCreatorEvent } from "../src/creator_alert.js";

test("alerts only when a storefront event needs creator action", async () => {
  const processing = alertEventSchema.parse({
    kind: "digital_asset",
    eventId: "evt_processing",
    creatorId: "creator_42",
    phone: "+15550102030",
    status: "processing",
    orderNumber: "ORDER-18",
    assetName: "Recipe Cards",
  });
  assert.equal(processing.kind, "digital_asset");
  assert.deepEqual(decideCreatorAlert(processing), {
    action: "skip",
    reason: "asset is still processing",
  });

  const ready = { ...processing, eventId: "evt_ready", status: "ready" as const };
  const requests: Array<{ to: string; body: string; idempotency_key: string }> = [];
  const result = await processCreatorEvent(ready, async (payload) => {
    requests.push(payload);
    return { message_id: "msg_test_123" };
  });

  assert.deepEqual(result, { outcome: "sent", message_id: "msg_test_123" });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    to: "+15550102030",
    body: "Order ORDER-18: Recipe Cards is ready for delivery. Open your storefront dashboard to review it.",
    idempotency_key: "creator-alert:creator_42:evt_ready",
  });
});

test("flags subscriber pauses and content jobs that need attention", () => {
  const subscriber = alertEventSchema.parse({
    kind: "subscriber_update",
    eventId: "evt_subscriber",
    creatorId: "creator_42",
    phone: "+15550102030",
    status: "paused",
    subscriberName: "Mina",
  });
  const content = alertEventSchema.parse({
    kind: "content_processing",
    eventId: "evt_content",
    creatorId: "creator_42",
    phone: "+15550102030",
    status: "needs_attention",
    contentTitle: "Holiday product reel",
  });

  assert.equal(decideCreatorAlert(subscriber).action, "send");
  assert.equal(decideCreatorAlert(content).action, "send");
});
