

export class NetworkHelper {

    /**
     * Try to fetch the url until it is reachable
     * @param url url to fetch
     */
    static async waitForUrl(
        url: string,
        { timeoutMs = 60000, intervalMs = 250 } = {},
    ): Promise<void> {
        const start = Date.now();
        

        while (true) {
            try {
                const res = await fetch(url);
                if (res.status === 200) {
                    return;
                }
            } catch (error: any) {
                console.log('Failed to waitForUrl: ', url);
                console.error("name:", error.name);      // e.g., TypeError
                console.error("message:", error.message);
                console.error('cause: ', error.cause);
                // ignore connection errors
            }

            if (Date.now() - start > timeoutMs) {
                throw new Error(`Timed out waiting for ${url} to be reachable`);
            }

            await new Promise((r) => setTimeout(r, intervalMs));
        }
    }
}
