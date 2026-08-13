/**
 * Waits for `promise`, but gives up at `deadline`: a shutdown may not hang on work that never
 * checks its abort signal, or that is stuck on a network call. What is left behind runs again after
 * the restart.
 *
 * A failure in the awaited work is logged instead of thrown: it may not stop the shutdown either.
 */
export async function waitUntilDeadline(promise: Promise<unknown>, { deadline, description }: { deadline: Date; description: string }): Promise<void> {
    let timer: NodeJS.Timeout | undefined;

    const timedOut = await Promise.race([
        promise.then(() => false).catch((error) => {
            console.error('Failed to wait for ' + description + ':');
            console.error(error);
            return false;
        }),
        new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(true), Math.max(deadline.getTime() - Date.now(), 0));
        }),
    ]);

    // Or the timer keeps the process alive until the deadline it no longer needs
    clearTimeout(timer);

    if (timedOut) {
        console.error('Gave up waiting for ' + description + ' to finish');
    }
}
