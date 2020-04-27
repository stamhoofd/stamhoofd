import { STErrors } from '@stamhoofd-common/errors';

import { Request } from "./Request"

export interface RequestMiddleware {

    onBeforeRequest?(request: Request<any>): Promise<void>;
    shouldRetryError?(request: Request<any>, response: Response, error: STErrors): Promise<boolean>;
    shouldRetryNetworkError?(request: Request<any>, error: Error): Promise<boolean>;
}