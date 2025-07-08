import fs from "fs";
import path from "path";
import { Config } from "./types";

const dirname = path.dirname(new URL(import.meta.url).pathname);
const configPath = path.resolve(dirname, "../config.json");

export function loadConfig(): Config {
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
