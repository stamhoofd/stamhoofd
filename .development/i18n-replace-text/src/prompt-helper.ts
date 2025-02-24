import readline from 'readline/promises';

export async function promptBoolean(message: string) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

    rl.on("close", () => process.exit());
    
    rl.question(message + ' ');

    const answer: string = await new Promise(resolve => {
        (rl as any)['input'].on("keypress", () => {
            const line = rl.line;
            resolve(line)
            });
    });

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
