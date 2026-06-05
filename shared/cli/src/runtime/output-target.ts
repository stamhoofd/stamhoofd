export enum OutputStream {
    Stdout = 'stdout',
    Stderr = 'stderr',
}

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
        activeOutputTarget.log(message);
        return;
    }

    if (stream === OutputStream.Stderr) {
        console.error(message);
        return;
    }

    console.log(message);
}

export const defaultOutputWriter: OutputWriter = writeOutputLine;
