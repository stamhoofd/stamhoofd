

import { exec } from 'child_process';
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
                const isOk = await isUrl200(url);
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

/**
 * Checks if a URL returns a 200 HTTP status code using curl.
 * @param {string} url - The URL to check.
 * @returns {Promise<boolean>} - Resolves to true if status 200, false otherwise.
 */
async function isUrl200(url: string): Promise<boolean> {
  return await new Promise<boolean>((resolve, reject) => {
    // Run curl in silent mode, output only the HTTP status code
    exec(`curl -o /dev/null -s -w "%{http_code}" ${url}`, (error, stdout) => {
      if (error) {
        return reject(error);
      }
      const statusCode = parseInt(stdout, 10);
      resolve(statusCode === 200);
    });
  });
}
