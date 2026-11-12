/** Presents a Turbo NDJSON line, preserving diagnostics and unknown records. */
export function forwardTurboLine(
    line: string,
    write: (stream: 'stdout' | 'stderr', text: string) => void,
): void;

/** Runs pnpm/Turbo with managed-session verbosity and signal forwarding; returns its exit code. */
export function runTurbo(args: string[], options?: { bufferOutput?: boolean }): Promise<number>;
