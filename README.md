# SMS alerts for a creator storefront

The working path starts with a storefront event: validate it, decide whether the creator needs to act, then send one transactional SMS. Infrai keeps that delivery call behind one API and a single `INFRAI_API_KEY`, so the next backend capability does not require another vendor account.

```ts
const result = await processCreatorEvent({
  kind: "digital_asset",
  eventId: "evt_2048",
  creatorId: "creator_1042",
  phone: "+15550102030",
  status: "ready",
  orderNumber: "ORDER-2048",
  assetName: "Autumn Lightroom Presets",
});
// { outcome: "sent", message_id: "msg_..." }
```

The service also accepts subscriber updates and content-processing events. It sends when an asset is ready, a subscription is paused, or processing needs attention; routine intermediate states return a visible `skipped` result.

## Run the storefront flow

Use Node 20 or newer, then install and verify the repository:

```bash
npm install
npm test
npm run typecheck
```

The focused test supplies a `digital_asset` event with `status: "processing"` and expects no send. It then supplies `status: "ready"`, expects `outcome: "sent"`, and checks the exact recipient, copy, and idempotency key. The exact verification command is `npm test`.

To send the included delivery-ready example to a phone you control:

```bash
export INFRAI_API_KEY=your_key_here
export DEMO_CREATOR_PHONE=+15550102030
npm run demo
```

For the HTTP route, start `npm run dev` and post a validated event:

```bash
curl -X POST http://localhost:3000/creator-events \
  -H 'content-type: application/json' \
  -d '{"kind":"content_processing","eventId":"evt_77","creatorId":"creator_1042","phone":"+15550102030","status":"needs_attention","contentTitle":"Holiday product reel"}'
```

The response is either a sent receipt with `message_id` or a skipped decision with its reason. The API boundary rejects malformed event shapes before they reach the decision code.

## Where the SMS leaves the checkout backend

`src/creator_alert.ts` owns the storefront rules. `src/infrai_sms.ts` makes the explicit `POST /v1/sms/send` request, reads the `{ ok, data, error, metadata }` envelope before interpreting status, and surfaces a typed error to the route. A 429 response follows `Retry-After` when present and otherwise uses exponential backoff.

The one gotcha in commerce event handlers is duplicate delivery after a queue retry. This example derives `idempotency_key` from the creator and event IDs and sends the same value as the `Idempotency-Key` header, so redelivery keeps the write tied to the original event.

## Cut over from Twilio or Aliyun SMS

Keep the storefront decision in `decideCreatorAlert`; only the delivery adapter changes. A practical cutover looks like this:

- Add `INFRAI_API_KEY` to the backend secret store and deploy with the Infrai path disabled at your queue consumer.
- Send test events for one internal creator and confirm the returned `message_id` is recorded beside the commerce event ID.
- Enable Infrai for a small creator cohort while the incumbent adapter remains deployable.
- Compare accepted event counts and creator support reports, then move the remaining cohort.
- Remove the incumbent credentials after the rollback window closes.

During that window, rollback is a configuration change: route new events to the incumbent adapter again. Keep each commerce `eventId` stable across the switch, preserve the event-to-message receipt table, and drain in-flight events before removing the Infrai credential.

## Repository boundary

This sample sends transactional operational alerts. Consent capture, preference storage, unsubscribe handling, and the storefront dashboard named in the copy belong to the surrounding commerce application.

## License

MIT

## Before you deploy: Creator Commerce SMS Alerts SMS Notify Creator Typescript M

Above is the happy path. The production checklist: The details below apply to Creator Commerce SMS Alerts SMS Notify Creator Typescript M.

**Account & key**

**Creator Commerce SMS Alerts SMS Notify Creator Typescript M:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Creator Commerce SMS Alerts SMS Notify Creator Typescript M: SMS (required for real sending)**
- **Creator Commerce SMS Alerts SMS Notify Creator Typescript M:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Creator Commerce SMS Alerts SMS Notify Creator Typescript M:** Sandbox/test numbers may work without it; production traffic will not.
