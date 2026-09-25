import { OutputStream } from '@stamhoofd/stdsync';

export { OutputStream };

export type OutputTarget = {
    log(message: string): void;
    write(chunk: string | Buffer, stream?: OutputStream): void;
};

export type OutputWriter = (message: string, stream?: OutputStream) => void;

let activeOutputTarget: OutputTarget | undefined;

export function setActiveOutputTarget(target: OutputTarget | undefined): void {
    activeOutputTarget = target;
}

export function writeOutputLine(message: string, stream: OutputStream = OutputStream.Stdout): void {
    if (activeOutputTarget) {
        if (stream === OutputStream.Stderr) {
            activeOutputTarget.write(`${message}\n`, stream);
        } else {
            activeOutputTarget.log(message);
        }
        return;
    }

    if (stream === OutputStream.Stderr) {
        console.error(message);
        return;
    }

    console.log(message);
}

export function writeOutputChunk(chunk: string | Buffer, stream: OutputStream): void {
    if (activeOutputTarget) {
        activeOutputTarget.write(chunk, stream);
        return;
    }

    (stream === OutputStream.Stderr ? process.stderr : process.stdout).write(chunk);
}

export const defaultOutputWriter: OutputWriter = writeOutputLine;
