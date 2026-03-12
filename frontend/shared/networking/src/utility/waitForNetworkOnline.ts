export function waitForNetworkOnline(timeout = 10000): Promise<void> {
    return new Promise((resolve) => {
        let resolved = false;
        const listener = function () {
            if (resolved) {
                return;
            }
            resolved = true;

            // Self reference to always remote the listener
            window.removeEventListener('online', listener);
            resolve();
        };
        window.addEventListener('online', listener);
        setTimeout(listener, timeout);
    });
}
