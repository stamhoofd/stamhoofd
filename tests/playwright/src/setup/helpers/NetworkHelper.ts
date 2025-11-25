
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
                const isOk = await fetch(url);
                if (isOk) {
                    return;
                } else {
                    throw new Error(`Failed to fetch ${url}`);
                }
            } catch (error) {
                console.log('failed wait for: ', url);
                console.error(error);
                // ignore connection errors
            }

            if (Date.now() - start > timeoutMs) {
                throw new Error(`Timed out waiting for ${url} to be reachable`);
            }

            await new Promise((r) => setTimeout(r, intervalMs));
        }
    }
}
