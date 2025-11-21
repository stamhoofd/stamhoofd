/**
 * Singleton to track process state
 */
class ProcessInfoInstance {
    /**
     * Whether caddy was started by the current process.
     * This is used to know whether to stop caddy in the global teardown.
     */
    private static _didStartCaddy = false;

    /**
     * Flag that caddy was started by the current process
     */
    flagCaddyStarted() {
        ProcessInfoInstance._didStartCaddy = true;
    }

    /**
     * Whether caddy was started by the current process
     */
    get didStartCaddy() {
        return ProcessInfoInstance._didStartCaddy;
    }
}

export const ProcessInfo = new ProcessInfoInstance();
