import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables from process.cwd() or Backend/.env
const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "Backend", ".env"),
];

for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export interface EnvConfig {
  API_KEY: string;
  CLIENT_CODE: string;
  PASSWORD: string;
  TOTP_SECRET: string;
  STATIC_IP: string;
  MAC_ADDRESS: string;
}

function getEnv(name: string, fallbackName?: string): string {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}${fallbackName ? ' or ' + fallbackName : ''}. Check your .env file.`
    );
  }
  return value;
}

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = {
      API_KEY: getEnv("API_KEY", "ANGEL_API_KEY"),
      CLIENT_CODE: getEnv("CLIENT_CODE", "ANGEL_CLIENT_ID"),
      PASSWORD: getEnv("PASSWORD", "ANGEL_PASSWORD"),
      TOTP_SECRET: getEnv("TOTP_SECRET", "ANGEL_TOTP"),
      STATIC_IP: getEnv("STATIC_IP"),
      MAC_ADDRESS: getEnv("MAC_ADDRESS"),
    };
  }
  return _config;
}
