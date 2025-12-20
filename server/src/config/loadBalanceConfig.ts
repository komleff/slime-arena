import fs from "fs";
import path from "path";
import { resolveBalanceConfig, ResolvedBalanceConfig } from "@slime-arena/shared";

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "..", "..", "..", "config", "balance.json");

export function loadBalanceConfig(configPath = DEFAULT_CONFIG_PATH): ResolvedBalanceConfig {
    const raw = fs.readFileSync(configPath, "utf-8");
    const data = JSON.parse(raw) as unknown;
    return resolveBalanceConfig(data);
}
