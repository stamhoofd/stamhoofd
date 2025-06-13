/**
 * Optimized algorithm to maximize the total discount
 * Returns an array where each index corresponds to the nth discount for each item
 * @param priceMatrix A 2D array where priceMatrix[i][j] represents the discount amount for the ith item at the jth position
 */
export function calculateHungarianAlgorithm(priceMatrix: number[][]): number[] {
    // No items to process
    if (priceMatrix.length === 0) {
        return [];
    }

    if (priceMatrix.length > 500) {
        throw new Error('Too many items to process. Maximum is 500.');
    }

    // Convert to cost minimization problem by negating values (since we want to maximize discount)
    const C = priceMatrix.map(row => row.map(val => -val));

    const J = C.length; // height of the cost matrix
    const W = C[0].length; // width of the cost matrix

    if (J > W) {
        throw new Error('Number of items cannot exceed number of positions');
    }

    // job[w] = job assigned to w-th worker, or -1 if no job assigned
    // note: a W-th worker was added for convenience
    const job: number[] = new Array(W + 1).fill(-1);
    const ys: number[] = new Array(J).fill(0);
    const yt: number[] = new Array(W + 1).fill(0); // potentials

    const inf = Number.MAX_SAFE_INTEGER;

    for (let jCur = 0; jCur < J; ++jCur) { // assign jCur-th job
        let wCur = W;
        job[wCur] = jCur;

        // min reduced cost over edges from Z to worker w
        const minTo: number[] = new Array(W + 1).fill(inf);
        const prev: number[] = new Array(W + 1).fill(-1); // previous worker on alternating path
        const inZ: boolean[] = new Array(W + 1).fill(false); // whether worker is in Z

        while (job[wCur] !== -1) { // runs at most jCur + 1 times
            inZ[wCur] = true;
            const j = job[wCur];
            let delta = inf;
            let wNext = 0;

            for (let w = 0; w < W; ++w) {
                if (!inZ[w]) {
                    const q = C[j][w] - ys[j] - yt[w];
                    if (q < minTo[w]) {
                        minTo[w] = q;
                        prev[w] = wCur;
                    }
                    if (minTo[w] < delta) {
                        delta = minTo[w];
                        wNext = w;
                    }
                }
            }

            // delta will always be nonnegative,
            // except possibly during the first time this loop runs
            // if any entries of C[jCur] are negative
            for (let w = 0; w <= W; ++w) {
                if (inZ[w]) {
                    ys[job[w]] += delta;
                    yt[w] -= delta;
                }
                else {
                    minTo[w] -= delta;
                }
            }
            wCur = wNext;
        }

        // update assignments along alternating path
        let w: number;
        for (; wCur !== W; wCur = w) {
            w = prev[wCur];
            job[wCur] = job[w];
        }
    }

    // Extract assignment indices for each job
    const result: number[] = new Array(J);
    for (let w = 0; w < W; ++w) {
        if (job[w] !== -1) {
            result[job[w]] = w;
        }
    }

    return result;
}
