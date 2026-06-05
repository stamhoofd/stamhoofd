class ProcessInfoInstance {
    private static _didStartCaddy = false;

    flagCaddyStarted() {
        ProcessInfoInstance._didStartCaddy = true;
    }

    get didStartCaddy() {
        return ProcessInfoInstance._didStartCaddy;
    }
}

export const ProcessInfo = new ProcessInfoInstance();
