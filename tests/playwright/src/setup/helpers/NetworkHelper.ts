export class NetworkHelper {
    static async waitForUrl(
        url: string,
        { timeoutMs = 60000, intervalMs = 250 } = {},
    ) {
        const start = Date.now();
        

        while (true) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    return;
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
