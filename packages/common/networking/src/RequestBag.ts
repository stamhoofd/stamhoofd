import { Request } from './Request';

/**
 * Group related requests so you can cancel them easily when they are no longer needed
 */
export class RequestBag {
    /**
     * We use a WeakMap so all the requests can get garbage collected
     * when all references to an instance disappears.
     * Note: since this is javascript, we cannot automatically cancel all pending requests in a RequestBag
     * when the associated key is deallocated (it is possible in newer browsers, but with a high and unreliable delay);
     * So use the .cancel() method on the bag to stop all requests in a bag properly if they are no longer needed
     */
    static bags: WeakMap<any, RequestBag> = new WeakMap();

    static get(object: any) {
        return this.bags.get(object);
    }

    static getOrCreate(object: any) {
        return this.get(object) ?? this.create(object);
    }

    private static create(object: any) {
        const bag = new RequestBag();
        this.bags.set(object, bag);
        return bag;
    }

    requests: Request<any>[] = [];

    addRequest(request: Request<any>) {
        this.requests.push(request);
    }

    removeRequest(request: Request<any>) {
        const index = this.requests.findIndex(r => r === request);
        if (index !== -1) {
            this.requests.splice(index, 1);
        }
    }

    cancel() {
        for (const request of this.requests) {
            request.cancel();
        }
        this.requests = [];
    }
}
