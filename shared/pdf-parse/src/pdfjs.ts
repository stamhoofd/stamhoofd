/**
 * The pdf.js build this package runs on, and the worker it runs it with. One module, because both
 * choices only hold together as a pair and both have to hold in the api, in Vite and in the app.
 *
 * `legacy/` rather than `build/`: the default build targets current browsers only, and the app ships
 * into whatever WebView the device has. The legacy build is the same code transpiled down, and it is
 * also the build pdf.js documents for Node.
 *
 * Importing `pdf.worker.mjs` here and handing pdf.js the handler it exports is what makes one setup
 * work in all three. Left to itself pdf.js reaches for `GlobalWorkerOptions.workerSrc` - a url it
 * either spawns a `Worker` from or imports dynamically - which is a url every consumer would have to
 * produce for its own bundler, and which has no answer at all in a Capacitor WebView. With the
 * handler already on `globalThis`, pdf.js takes it and never looks for that url, so a consumer
 * imports this package and is done: no worker file to copy, no bundler configuration, no asset url.
 *
 * What it costs is the parse running on the calling thread instead of in a worker. In Node that is
 * what pdf.js does anyway, so nothing changes there, and reading the text of a one-page extract is
 * not work worth a thread. A caller that renders pdfs - rather than reads them, as this package does
 * - weighs that differently and should set up its own worker.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// The global pdf.js looks at before it goes out for a worker of its own
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export const { getDocument, VerbosityLevel } = pdfjs;
