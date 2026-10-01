import { alertEventSchema, processCreatorEvent } from "../src/creator_alert.js";

const phone = process.env.DEMO_CREATOR_PHONE;
if (!phone) throw new Error("DEMO_CREATOR_PHONE is required");

const event = alertEventSchema.parse({
  kind: "digital_asset",
  eventId: `delivery-demo-${Date.now()}`,
  creatorId: "creator_1042",
  phone,
  status: "ready",
  orderNumber: "ORDER-2048",
  assetName: "Autumn Lightroom Presets",
});

console.log(await processCreatorEvent(event));
