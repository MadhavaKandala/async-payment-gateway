# Async Payment Gateway

A production-ready payment gateway with asynchronous job processing, Redis-based queues, webhook delivery, refund management, and an embeddable SDK.

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js (for local development, optional)

### Quick Start
1. Clone the repository.
2. Run the application:
   ```bash
   docker-compose up -d --build
   ```
3. Services will be available at:
   - **API**: http://localhost:8000
   - **Dashboard**: http://localhost:3000
   - **Checkout Service**: http://localhost:3001
   - **Redis**: localhost:6379
   - **Postgres**: localhost:5432

### Environment Variables
The application uses the following environment variables (configured in `docker-compose.yml`):
- `DATABASE_URL`: Postgres connection string.
- `REDIS_URL`: Redis connection string.
- `TEST_MODE`: Enable test mode (randomized outcomes).
- `WEBHOOK_RETRY_INTERVALS_TEST`: Enable short retry intervals for testing.

## API Documentation

### Authentication
Headers required for most endpoints:
- `X-Api-Key`: `key_test_abc123`
- `X-Api-Secret`: `secret_test_xyz789`

### Endpoints

#### Payments
- **POST /api/v1/payments**: Create a payment (Async). Returns 201 Pending.
- **POST /api/v1/payments/:id/capture**: Capture a successful payment.

#### Refunds
- **POST /api/v1/payments/:id/refunds**: Initiate a refund.
- **GET /api/v1/refunds/:id**: Get refund status.

#### Webhooks
- **GET /api/v1/webhooks**: List webhook logs.
- **POST /api/v1/webhooks/:id/retry**: Retry a failed webhook.
- **POST /api/v1/webhooks/config**: Update webhook URL.

#### Test
- **GET /api/v1/test/jobs/status**: Get Queue Statistics.

## Testing Instructions

1. **End-to-End Payment**:
   - Open **Dashboard** at http://localhost:3000.
   - Go to **Webhooks** and configure a URL (e.g. using `webhook.site` or local listener).
   - Go to **API Docs** and copy the SDK Snippet -> Save as `test.html`?
   - Or simply use the **Checkout Page** directly: `http://localhost:3001/checkout?order_id=ord_123&key=key_test_abc123`.
   - Complete payment.
   - Check Dashboard logs for `payment.success`.

2. **Automated Verification**:
   - The system supports `submission.yml` commands.

## Webhook Integration

Verify signatures using HMAC-SHA256 with your Webhook Secret.
Header: `X-Webhook-Signature`.
Payload: JSON Body.

## SDK Integration

```html
<script src="http://localhost:3001/checkout.js"></script>
<script>
  const checkout = new PaymentGateway({
    key: 'key_test_abc123',
    orderId: 'order_123'
  });
  checkout.open();
</script>
```
