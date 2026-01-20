import React from 'react';

const ApiDocs = () => {
    return (
        <div data-test-id="api-docs">
            <h2>Integration Guide</h2>

            <div className="card">
                <section data-test-id="section-create-order">
                    <h3>1. Create Order</h3>
                    <pre data-test-id="code-snippet-create-order">
                        <code>
                            {`curl -X POST http://localhost:8000/api/v1/payments \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "INR",
    "method": "card",
    "order_id": "order_123"
  }'`}
                        </code>
                    </pre>
                </section>

                <section data-test-id="section-sdk-integration">
                    <h3>2. SDK Integration</h3>
                    <pre data-test-id="code-snippet-sdk">
                        <code>
                            {`<script src="http://localhost:3001/checkout.js"></script>
<script>
const checkout = new PaymentGateway({
  key: 'key_test_abc123',
  orderId: 'order_123',
  onSuccess: (response) => {
    console.log('Payment ID:', response.paymentId);
  }
});
checkout.open();
</script>`}
                        </code>
                    </pre>
                </section>

                <section data-test-id="section-webhook-verification">
                    <h3>3. Verify Webhook Signature</h3>
                    <pre data-test-id="code-snippet-webhook">
                        <code>
                            {`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}`}
                        </code>
                    </pre>
                </section>
            </div>
        </div>
    );
};

export default ApiDocs;
