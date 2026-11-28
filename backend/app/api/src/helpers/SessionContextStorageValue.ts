import type { Request } from '@stamhoofd/node-endpoints';

export interface SessionContextStorageValue {
    request: Request;
}
