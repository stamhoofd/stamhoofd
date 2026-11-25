/** Ping a deployment-owned secret URL after successful work. Delivery is best effort. */
export async function sendSuccessHeartbeat(url: string | undefined): Promise<void> {
    if (!url) return;
    try {
        if (new URL(url).protocol === 'https:') {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'error',
                signal: AbortSignal.timeout(2000),
            });
            await response.body?.cancel();
            if (response.ok) return;
        }
    } catch {
        // Fetch and URL errors can contain the secret URL.
    }
    console.warn('Completion heartbeat could not be delivered.');
}
