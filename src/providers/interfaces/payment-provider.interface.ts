export interface PaymentIntentOptions {
  amount: number; // in minor units, e.g., cents
  currency: string;
  metadata?: Record<string, string>;
  customerId?: string;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
}

export interface RefundOptions {
  paymentIntentId: string;
  amount?: number; // optional partial refund
  reason?: string;
}

export interface RefundResult {
  id: string;
  status: string;
  amount: number;
}

export interface IPaymentProvider {
  createPaymentIntent(options: PaymentIntentOptions): Promise<PaymentIntentResult>;
  retrievePaymentIntent(id: string): Promise<PaymentIntentResult>;
  createRefund(options: RefundOptions): Promise<RefundResult>;
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): any;
}
