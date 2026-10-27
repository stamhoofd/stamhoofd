import type { Request } from '@node/endpoints';

export interface SessionContextStorageValue {
    request: Request;
}
