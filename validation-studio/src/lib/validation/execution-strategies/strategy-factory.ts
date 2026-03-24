import { ValidationExecutionStrategy } from "./types";
import { SinglePassStrategy } from "./single-pass-strategy";
import { TwoPassStrategy } from "./two-pass-strategy";
import { Configuration } from "@/types/configuration";

export class StrategyFactory {
    static getExecutionStrategy(config: Configuration): ValidationExecutionStrategy {
        if (config.executionStrategy === 'two-pass') {
            console.log("[StrategyManager] Using TwoPassStrategy via Configuration");
            return new TwoPassStrategy();
        }

        console.log("[StrategyManager] Using SinglePassStrategy via Configuration");
        return new SinglePassStrategy();
    }
}
