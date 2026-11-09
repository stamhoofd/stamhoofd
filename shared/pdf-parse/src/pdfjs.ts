/**
 * The `legacy/` build rather than `build/`: the default one targets current browsers only, while the
 * app ships into whatever WebView the device has, and legacy is also the build pdf.js documents for
 * Node.
 */
import './polyfills.js';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

interface WorkerGlobal {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
}

// Importing `pdf.worker.mjs` announces it on `globalThis`, which pdf.js then consults for every
// document anyone opens - so merely importing this module would take a pdf viewer elsewhere in the
// bundle off its worker. Put it back down, but only when it is the handler this import just set.
const workerGlobal = globalThis as WorkerGlobal;
if (workerGlobal.pdfjsWorker?.WorkerMessageHandler === WorkerMessageHandler) {
    delete workerGlobal.pdfjsWorker;
}

/**
 * A pdf.js worker for a single document, running on the calling thread.
 *
 * Per document rather than global, so that no consumer of this package has its own pdf.js pushed off
 * its worker. The caller owns it: `destroy` the worker and `close` the channel when the document is
 * done, or Node holds the event loop open on the port.
 */
export function createMainThreadWorker(verbosity: number): { worker: pdfjs.PDFWorker; close: () => void } {
    const channel = new MessageChannel();

    // A `MessagePort` only delivers once started, and pdf.js attaches listeners rather than setting
    // `onmessage`, which would have started it as a side effect
    channel.port1.start();
    channel.port2.start();

    WorkerMessageHandler.initializeFromPort(channel.port2);

    return {
        // `PDFWorker.create` rather than the constructor, whose generated types declare `port` as
        // `null`. A `MessagePort` is not the `Worker` the types ask for, but it is the half of one
        // pdf.js uses. Verbosity is read when the worker is created, before `getDocument` sets the
        // global level, so it has to be passed here too
        worker: pdfjs.PDFWorker.create({ port: channel.port1 as unknown as Worker, verbosity }),
        close: () => {
            channel.port1.close();
            channel.port2.close();
        },
    };
}

export const { getDocument, VerbosityLevel } = pdfjs;
