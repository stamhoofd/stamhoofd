export type OutputTarget = {
    log(message: string): void;
    write(chunk: string | Buffer, stream?: 'stdout' | 'stderr'): void;
};

export type OutputWriter = (message: string, stream?: 'stdout' | 'stderr') => void;

let activeOutputTarget: OutputTarget | undefined;

export function setActiveOutputTarget(target: OutputTarget | undefined): void {
    activeOutputTarget = target;
}

export function writeOutputLine(message: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    if (activeOutputTarget) {
        activeOutputTarget.log(message);
        return;
    }

    if (stream === 'stderr') {
        console.error(message);
        return;
    }

    console.log(message);
}

export const defaultOutputWriter: OutputWriter = writeOutputLine;
