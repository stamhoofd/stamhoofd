import { getDomain } from "./getDomain";

export function getUrl(
    service: "api" | "dashboard" | "registration" | "webshop" | string,
    workerId: string,
) {
    return 'http://' + getDomain(service, workerId);
}
