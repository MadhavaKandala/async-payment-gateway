class PaymentGateway {
    constructor(options) {
        this.options = options || {};
        this.modalId = 'payment-gateway-modal';
    }

    open() {
        if (document.getElementById(this.modalId)) return;

        const { key, orderId } = this.options;

        // Create Modal Structure
        const modal = document.createElement('div');
        modal.id = this.modalId;
        modal.setAttribute('data-test-id', 'payment-modal');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '9999';

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.backgroundColor = 'white';
        content.style.width = '400px';
        content.style.height = '500px';
        content.style.position = 'relative';
        content.style.borderRadius = '8px';
        content.style.overflow = 'hidden';

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.className = 'close-button';
        closeBtn.setAttribute('data-test-id', 'close-modal-button');
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '10px';
        closeBtn.style.zIndex = '10';
        closeBtn.style.border = 'none';
        closeBtn.style.background = 'transparent';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => this.close();

        // Iframe
        const iframe = document.createElement('iframe');
        iframe.setAttribute('data-test-id', 'payment-iframe');
        // Assuming Checkout Service is on localhost:3001, but in production it might differ.
        // For this task, hardcoded or relative? The SDK is loaded FROM 3001, so relative path works if we know the base.
        // But the script is loaded on merchant site (e.g. localhost:5000). Relative won't work.
        // Must use absolute URL.
        const baseUrl = 'http://localhost:3001';
        iframe.src = `${baseUrl}/checkout?order_id=${orderId}&key=${key}&embedded=true`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';

        content.appendChild(closeBtn);
        content.appendChild(iframe);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Listener
        window.addEventListener('message', this.handleMessage.bind(this));
    }

    handleMessage(event) {
        // Validate origin if necessary (skip for now as per instructions)
        const { type, data } = event.data;

        if (type === 'payment_success') {
            if (this.options.onSuccess) this.options.onSuccess(data);
            this.close();
        } else if (type === 'payment_failed') {
            if (this.options.onFailure) this.options.onFailure(data);
            // Don't close automatically on failure? Or yes?
        } else if (type === 'close_modal') {
            this.close();
        }
    }

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            document.body.removeChild(modal);
        }
        if (this.options.onClose) this.options.onClose();
        window.removeEventListener('message', this.handleMessage.bind(this));
    }
}

export default PaymentGateway;
