import fs from 'fs';
import path from 'path';
import { Config } from './types';

export function loadConfig(): Config {
  const configPath = path.resolve('config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as Config;
}
