export function getDomain(
    service: "api" | "dashboard" | "registration" | "webshop" | string,
    workerId: string,
) {
    return `playwright-${service}-${workerId}.stamhoofd`;
}
