/** Registered API handlers that can be selected for local capture. */
export const captureEndpoints = {
    PatchInvoicesEndpoint: { method: 'PATCH', route: '/invoices' },
    GetInvoicesEndpoint: { method: 'GET', route: '/invoices' },
    HealthEndpoint: { method: 'GET', route: '/health' },
};

export const statisticsCycle = 'statistics.cycle';
export const devCaptureSelectors = [
    '*',
    ...Object.values(captureEndpoints).map(({ method, route }) => `${method} ${route}`),
    statisticsCycle,
];
