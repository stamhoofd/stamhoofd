import { AutoEncoder } from '../classes/AutoEncoder.js';

export function isAutoEncoder(obj: unknown): obj is AutoEncoder {
    return /* obj instanceof AutoEncoder || */ (typeof obj === 'object' && obj !== null && (obj as any)._isAutoEncoder);
}
