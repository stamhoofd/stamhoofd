import { confirm as confirmPrompt, input as inputPrompt, select as selectPrompt } from '@inquirer/prompts';
import { getCliTelemetry, withCliPrompt } from './telemetry.js';

export function confirm(...args: Parameters<typeof confirmPrompt>): Promise<boolean> {
    return withCliPrompt(() => confirmPrompt(args[0], { ...args[1], signal: args[1]?.signal ?? getCliTelemetry()?.signal }));
}

export function input(...args: Parameters<typeof inputPrompt>): Promise<string> {
    return withCliPrompt(() => inputPrompt(args[0], { ...args[1], signal: args[1]?.signal ?? getCliTelemetry()?.signal }));
}

export function select<Value>(...args: Parameters<typeof selectPrompt<Value>>): Promise<Value> {
    return withCliPrompt(() => selectPrompt(args[0], { ...args[1], signal: args[1]?.signal ?? getCliTelemetry()?.signal }));
}

export function requireInteractive(message: string): void {
    if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error(`An interactive terminal is required. ${message}`);
}
