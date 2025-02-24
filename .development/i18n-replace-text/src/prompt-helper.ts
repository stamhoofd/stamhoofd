import readline from 'readline/promises';

export async function promptBoolean(message: string) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

    rl.on("SIGINT", () => process.exit());
    
    rl.question(message + ' ');

    let listener = () => {};

    const answer: string = await new Promise(resolve => {
        listener = () => resolve(rl.line);
        (rl as any)['input'].on("keypress", listener);
    });

    (rl as any)['input'].removeListener("keypress", listener);

    rl.close();
    rl.removeAllListeners();
    
    return answerToBoolean(answer);
}

function answerToBoolean(answer: string): boolean {
    if(!answer) {
        return true;
    }
    
    switch(answer.trim().toLowerCase()) {
        case 'y':
        case 'yes': {
            return true;
        }
        default: return false;
    }
}
