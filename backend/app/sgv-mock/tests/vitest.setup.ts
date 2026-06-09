import { Request } from "@simonbackx/simple-endpoints";

Error.stackTraceLimit = 100;

Request.defaultVersion = 1;

process.env.TZ = "UTC";

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error("Process should always run in UTC timezone");
}
