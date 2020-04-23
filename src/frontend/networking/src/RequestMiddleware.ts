import { Request } from "./Request"

export interface RequestMiddleware {

    onBeforeRequest(request: Request<any>);
    onBeforeSendHeaders(request: Request<any>);
    shouldRetryRequest(request: Request<any>, response: Response): Promise<boolean>;
    shouldRetryError(request: Request<any>, error: Error): Promise<boolean>;

}