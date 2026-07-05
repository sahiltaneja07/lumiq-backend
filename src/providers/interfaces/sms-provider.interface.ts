export interface SmsOptions {
  to: string;
  body: string;
}

export interface ISmsProvider {
  sendSms(options: SmsOptions): Promise<{ messageId: string }>;
}
