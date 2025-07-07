import fs from "fs";
import path from "path";
import { Config } from "./types";

const dirname = path.dirname(new URL(import.meta.url).pathname);

export function loadConfig(): Config {
  const configPath = path.resolve(dirname, "../config.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as Config;
}
