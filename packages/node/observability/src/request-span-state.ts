/** Internal to the provider lane. The key is the router's Request object, never a header or request ID. */
export const requestSpanIds = new WeakMap<
    object,
    Readonly<{ trace_id: string; span_id: string }>
>();
