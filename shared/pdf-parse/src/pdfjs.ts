/**
 * The pdf.js build this package runs on, and the worker it runs it with. One module, because both
 * choices only hold together as a pair and both have to hold in the api, in Vite and in the app.
 *
 * `legacy/` rather than `build/`: the default build targets current browsers only, and the app ships
 * into whatever WebView the device has. The legacy build is the same code transpiled down, and it is
 * also the build pdf.js documents for Node.
 *
 * The parse runs on the calling thread. Left to itself pdf.js reaches for
 * `GlobalWorkerOptions.workerSrc` - a url it either spawns a `Worker` from or imports dynamically -
 * which is a url every consumer would have to produce for its own bundler, and which has no answer
 * at all in a Capacitor WebView. Reading the text of a one-page extract takes about 20 ms, so a
 * thread is not what that work is short of, and in Node pdf.js stays on the calling thread anyway.
 *
 * What this does *not* do is decide that for anyone else. A caller that renders pdfs wants a real
 * worker, and `createMainThreadWorker` hands pdf.js a worker for one document instead of leaving a
 * mark on `globalThis` that would answer for every document in the bundle.
 */
// Before pdf.js, which is the whole point of it
import './polyfills.js';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

interface WorkerGlobal {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
}

/**
 * Loading `pdf.worker.mjs` announces it on `globalThis`, and that is a global pdf.js consults for
 * every document anyone opens: finding it, pdf.js puts that document on the calling thread. So
 * importing this module would quietly take a pdf *viewer* in the same bundle off its worker and
 * stall its rendering, which is not this package's call to make. Put the global back down - only
 * when it is the one this import just set - and ask for a worker per document instead.
 */
const workerGlobal = globalThis as WorkerGlobal;
if (workerGlobal.pdfjsWorker?.WorkerMessageHandler === WorkerMessageHandler) {
    delete workerGlobal.pdfjsWorker;
}

/**
 * A pdf.js worker that runs on the calling thread, belonging to one document.
 *
 * Both ends of the channel are on this thread, so the "worker" is a message port talking to itself
 * and pdf.js drives it the way it drives a real one. The caller owns it: `destroy` it and close the
 * channel when the document is done, or Node holds the event loop open on the open port.
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
        // pdf.js uses: it posts messages and listens for them
        // The worker carries its own verbosity, and it is configured the moment it is created -
        // before `getDocument` gets to set the global level - so it has to be told here too
        worker: pdfjs.PDFWorker.create({ port: channel.port1 as unknown as Worker, verbosity }),
        close: () => {
            channel.port1.close();
            channel.port2.close();
        },
    };
}

export const { getDocument, VerbosityLevel } = pdfjs;
