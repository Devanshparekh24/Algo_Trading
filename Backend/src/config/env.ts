import "dotenv/config";

export interface EnvConfig {
  API_KEY: string;
  CLIENT_CODE: string;
  PASSWORD: string;
  TOTP_SECRET: string;
  STATIC_IP: string;
  MAC_ADDRESS: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check your .env file.`
    );
  }
  return value;
}

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = {
      API_KEY: requireEnv("API_KEY"),
      CLIENT_CODE: requireEnv("CLIENT_CODE"),
      PASSWORD: requireEnv("PASSWORD"),
      TOTP_SECRET: requireEnv("TOTP_SECRET"),
      STATIC_IP: requireEnv("STATIC_IP"),
      MAC_ADDRESS: requireEnv("MAC_ADDRESS"),
    };
  }
  return _config;
}