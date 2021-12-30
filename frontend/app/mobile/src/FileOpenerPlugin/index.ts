import { registerPlugin } from '@capacitor/core';

export interface FileOpenerPlugin {
    open({ url: string}): Promise<void>;
}


const FileOpener = registerPlugin<FileOpenerPlugin>('FileOpener');

export default FileOpener;