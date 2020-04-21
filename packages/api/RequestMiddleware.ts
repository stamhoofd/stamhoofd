import { Request } from "./Request"

export interface RequestMiddleware {

    onBeforeRequest(request: Request);
    onBeforeSendHeaders(request: Request);
    shouldRetryRequest(request: Request, response: Response): Promise<boolean>;
    shouldRetryError(request: Request, error: Error): Promise<boolean>;

}