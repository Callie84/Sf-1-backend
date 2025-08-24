export interface Env {
  PORT: string;
  NODE_ENV: 'development' | 'test' | 'production';
  MONGO_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  JWT_REFRESH_EXPIRY: string;
  STRIPE_SECRET_KEY?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  OPENAI_API_KEY?: string;
  HUGGINGFACE_API_KEY?: string;
}
