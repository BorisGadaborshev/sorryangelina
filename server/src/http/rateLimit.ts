import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток, попробуйте через минуту' }
});
