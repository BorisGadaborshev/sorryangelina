import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const serverRoot = path.resolve(__dirname, '../..');

const loadEnvFile = (filename: string, override: boolean): void => {
  const fullPath = path.join(serverRoot, filename);
  if (!fs.existsSync(fullPath)) return;
  dotenv.config({ path: fullPath, override });
};

// Production takes variables from the process (systemd) and must not
// pick up a developer machine's .env.local. Local dev loads .env, then
// lets .env.local override it.
if (process.env.NODE_ENV === 'production') {
  loadEnvFile('.env', false);
} else {
  loadEnvFile('.env', false);
  loadEnvFile('.env.local', true);
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }
}

export const isProduction = process.env.NODE_ENV === 'production';
