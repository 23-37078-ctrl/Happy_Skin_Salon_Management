# Online appointment payments (PayPal Sandbox)

Guest and signed-in online bookings require full payment through PayPal Orders v2. FastAPI creates each order from the persisted booking total, captures it server-side, verifies the completed PHP amount, and writes the normal transaction record. The PayPal JS SDK v6 button never receives the secret. Walk-in checkout continues to accept cash and the existing staff-recorded digital methods.

## Configure local Sandbox credentials

1. In the PayPal Developer Dashboard, create or select a **Sandbox REST app** and copy its Client ID and Secret.
2. Put `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_MODE=sandbox` in the project-root `.env`. Keep the Secret only in this backend-read environment file; never add it to a `VITE_` variable. Set `VITE_PAYPAL_CLIENT_ID` to the same Sandbox Client ID for the browser SDK.
3. Start the FastAPI backend and Vite frontend. With `PAYPAL_MODE=sandbox`, the API uses `https://api-m.sandbox.paypal.com` and the frontend SDK is explicitly loaded in Sandbox mode.
4. Create a Sandbox Personal buyer account in the Developer Dashboard and use its credentials in the PayPal approval window. Do not use a real PayPal account for this flow.
5. Register a webhook under the Sandbox app for `PAYMENT.CAPTURE.COMPLETED` at the public HTTPS endpoint below. Copy the webhook ID (not a signing secret) to `PAYPAL_WEBHOOK_ID` and restart the API. The browser capture response is verified server-side as well; the webhook reconciles completed events if the browser closes during payment.

```text
https://your-api-domain.example/api/v1/customer/payments/paypal/webhook
```

For local webhook development, expose the API with a trusted HTTPS tunnel and register that public URL in the Sandbox app. PayPal's webhook signature verification requires the webhook ID and the original transmission headers.

## Apply the additive migration

The migration adds `booking_payment_attempts` and changes only the default provider for new summary rows. It preserves the unique transaction-per-booking constraint and existing PayMongo history. Review your database backup and connection target before applying:

```powershell
cd backend
..\.venv\Scripts\alembic.exe upgrade head
```

This migration was not applied as part of the code change. Existing database credentials/network access must be available when you choose to run it.

## Sandbox checks

- Create both guest and authenticated online bookings; verify PayPal's displayed amount matches the service total.
- Approve payment with a Sandbox Personal buyer, then confirm booking payment status, one transaction, reports, and receipt.
- Cancel a pending booking and confirm staff cannot confirm/check it in; retry an incomplete PayPal attempt.
- Confirm walk-in cash and staff-recorded digital checkout remain available.

## Deployment preparation (Sandbox only)

- Set `DATABASE_URL`, `SECRET_KEY`, `ENVIRONMENT=production`, and `CORS_ORIGINS` for the deployed API. Restrict CORS to the exact frontend origin.
- Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, and `PAYPAL_WEBHOOK_ID` in the API host's secret environment. Keep the Secret out of frontend build arguments and browser variables.
- Set `VITE_PAYPAL_CLIENT_ID` to the Sandbox Client ID in the frontend build environment, then rebuild the frontend. Docker Compose passes only this public Client ID to the Vite build.
- Apply Alembic migrations to the intended Supabase project after checking its backup and current revision. Confirm `/api/v1/health` reports the current schema version and check payment endpoint behavior with a Sandbox buyer.
- Register the webhook against the deployed public HTTPS API URL and verify its signature with the configured Sandbox Webhook ID.

The API service and JavaScript SDK are deliberately locked to Sandbox. A future Live transition requires a separately reviewed code change to allow the Live API host and SDK environment, a new PayPal Live Business app and credentials, a Live webhook and Webhook ID, a rebuild, and a controlled production verification. Do not change `PAYPAL_MODE` alone: this implementation rejects Live mode and does not activate real payments.
