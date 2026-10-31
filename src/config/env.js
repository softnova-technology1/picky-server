require('dotenv').config();

const requiredCore = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const optionalInDev = [
  'MONGODB_URI',
  'REDIS_URL',
  'WATI_API_ENDPOINT',
  'WATI_ACCESS_TOKEN',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
];

const validateEnv = () => {
  // Normalize WATI V3 env aliases
  if (!process.env.WATI_API_ENDPOINT && process.env.WATI_BASE_URL) {
    process.env.WATI_API_ENDPOINT = process.env.WATI_BASE_URL;
  }
  if (!process.env.WATI_ACCESS_TOKEN && process.env.WATI_API_KEY) {
    process.env.WATI_ACCESS_TOKEN = process.env.WATI_API_KEY;
  }

  const isDev = (process.env.NODE_ENV || 'development') === 'development';
  const missingCore = requiredCore.filter((key) => !process.env[key]);

  if (missingCore.length > 0) {
    console.error(`[ENV ERROR] Missing required environment variables: ${missingCore.join(', ')}`);
    process.exit(1);
  }

  if (!isDev) {
    const missingProd = optionalInDev.filter((key) => !process.env[key]);
    if (missingProd.length > 0) {
      console.error(`[ENV ERROR] Missing required production environment variables: ${missingProd.join(', ')}`);
      process.exit(1);
    }
  } else {
    // Provide friendly warning in dev
    const unconfigured = optionalInDev.filter((key) => !process.env[key] || process.env[key].includes('mock_') || process.env[key].includes('your_'));
    if (unconfigured.length > 0) {
      console.log(`ℹ️ [ENV NOTICE] Development mode active. Third-party services with mock values: ${unconfigured.join(', ')} (Fallbacks & Console Mock active)`);
    }
  }
};

module.exports = validateEnv;
