export class NetworkHelper {
    /**
     * Try to fetch the url until it is reachable.
     *
     * The timeout is generous on purpose: several e2e runs (from different worktrees) can boot
     * their backends at the same time on one machine, which makes a start-up that normally takes
     * seconds take a lot longer. Failures are only logged every few seconds, so a slow start does
     * not bury the rest of the output while a real failure is still reported with its last error.
     */
    static async waitForUrl(
        url: string,
        { timeoutMs = 120_000, intervalMs = 250, logIntervalMs = 5_000 } = {},
    ): Promise<void> {
        const start = Date.now();
        let lastError = 'no response';
        let lastLog = 0;

        while (true) {
            try {
                const res = await fetch(url);
                if (res.status === 200) {
                    return;
                }
                lastError = `status ${res.status}`;
            }
            catch (error: any) {
                // ignore connection errors
                lastError = `${error.name}: ${error.message}${error.cause ? ` (${String(error.cause)})` : ''}`;
            }

            const elapsed = Date.now() - start;
            if (elapsed > timeoutMs) {
                throw new Error(`Timed out waiting for ${url} to be reachable after ${Math.round(elapsed / 1000)}s: ${lastError}`);
            }

            if (elapsed - lastLog >= logIntervalMs) {
                lastLog = elapsed;
                console.log(`Still waiting for ${url} (${Math.round(elapsed / 1000)}s): ${lastError}`);
            }

            await new Promise(r => setTimeout(r, intervalMs));
        }
    }
}
