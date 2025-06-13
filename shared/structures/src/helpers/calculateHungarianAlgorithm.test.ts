import { calculateHungarianAlgorithm } from './calculateHungarianAlgorithm.js';

function test(matrix: number[][], expectedIndexes: number[]) {
    const result = calculateHungarianAlgorithm(matrix);
    expect(result).toEqual(expectedIndexes);
}

function testOptimalSum(matrix: number[][]) {
    const result = calculateHungarianAlgorithm(matrix);

    // Verify result has correct length
    expect(result).toHaveLength(matrix.length);

    // Verify each index is used exactly once
    const uniqueIndexes = new Set(result);
    expect(uniqueIndexes.size).toBe(result.length);

    // Verify all indexes are valid
    result.forEach((colIndex, rowIndex) => {
        expect(colIndex).toBeGreaterThanOrEqual(0);
        expect(colIndex).toBeLessThan(matrix[rowIndex].length);
    });

    // Calculate sum for this assignment
    const sum = result.reduce((total, colIndex, rowIndex) => {
        return total + matrix[rowIndex][colIndex];
    }, 0);

    // Verify this is indeed optimal by checking all possible permutations for small matrices
    if (matrix.length <= 10) {
        const allPermutations = generatePermutations(Array.from({ length: Math.min(matrix.length, matrix[0].length) }, (_, i) => i));
        let maxSum = -Infinity;

        for (const perm of allPermutations) {
            if (perm.length === matrix.length) {
                const permSum = perm.reduce((total, colIndex, rowIndex) => {
                    return total + matrix[rowIndex][colIndex];
                }, 0);
                maxSum = Math.max(maxSum, permSum);
            }
        }

        expect(sum).toBe(maxSum);
    }

    return { result, sum };
}

function generatePermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const perms = generatePermutations(rest);
        for (const perm of perms) {
            result.push([arr[i], ...perm]);
        }
    }
    return result;
}

describe('calculateHungarianAlgorithm', () => {
    it('should returns the highest possible combination', () => {
        test([
            [0, 10, 20],
            [0, 30, 45],
            [0, 50, 60],
        ], [0, 2, 1]); // 45 + 50 = 95, which is the highest possible combination
    });

    describe('Handling indeterminate cases', () => {
        it('when there are two equal options, it returns the lowest indexes', () => {
            test([
                [0, 10, 20],
                [0, 30, 40],
                [0, 50, 60],
            ], [0, 1, 2]); // not 0, 2, 1

            test([
                [0, 10, 20],
                [0, 50, 60],
                [0, 30, 40],
            ], [0, 1, 2]);
        });

        it('Last one in the list of indeterminate cases receives no discount 3x3', () => {
            test([
                [0, 10, 10],
                [0, 10, 10],
                [0, 10, 10],
            ], [1, 2, 0]);
        });

        it('Last one in the list of indeterminate cases receives no discount 4x4', () => {
            test([
                [0, 10, 10, 10],
                [0, 10, 10, 10],
                [0, 10, 10, 10],
                [0, 10, 10, 10],
            ], [1, 2, 3, 0]);
        });

        it('Last two in the list of indeterminate cases receives no discount 4x4', () => {
            test([
                [0, 10, 10, 0],
                [0, 10, 10, 0],
                [0, 10, 10, 0],
                [0, 10, 10, 0],
            ], [1, 2, 0, 3]);
        });

        it('Last three in the list of indeterminate cases receives no discount 5x5', () => {
            test([
                [0, 10, 10, 0, 0],
                [0, 10, 10, 0, 0],
                [0, 10, 10, 0, 0],
                [0, 10, 10, 0, 0],
                [0, 10, 10, 0, 0],
            ], [1, 2, 0, 3, 4]);
        });
    });

    describe('Edge cases', () => {
        it('should handle 1x1 matrix', () => {
            test([[42]], [0]);
        });

        it('should handle 2x2 matrix', () => {
            test([
                [10, 5],
                [3, 8],
            ], [0, 1]);
        });

        it('should handle matrices with all zeros', () => {
            test([
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0],
            ], [0, 1, 2]); // always prefer the lowest indexes for first items
        });

        it('should handle matrices with negative values', () => {
            test([
                [-10, -5, -1],
                [-3, -8, -2],
                [-6, -4, -9],
            ], [2, 0, 1]); // -1 + (-3) + (-4) = -8 is the maximum (least negative)
        });

        it('should handle matrices with mixed positive and negative values', () => {
            testOptimalSum([
                [10, -5, 3],
                [-2, 8, 1],
                [4, -1, 6],
            ]);
        });
    });

    describe('Larger matrices', () => {
        it('should handle 4x4 matrix', () => {
            testOptimalSum([
                [82, 83, 69, 92],
                [77, 37, 49, 92],
                [11, 69, 5, 86],
                [8, 9, 98, 23],
            ]);
        });

        it('should handle 5x5 matrix', () => {
            testOptimalSum([
                [12, 7, 9, 15, 3],
                [8, 14, 6, 11, 18],
                [13, 5, 16, 2, 10],
                [4, 17, 1, 8, 12],
                [19, 3, 11, 7, 14],
            ]);
        });

        it('should handle 6x6 matrix', () => {
            testOptimalSum([
                [23, 17, 31, 12, 8, 45],
                [19, 28, 14, 33, 22, 11],
                [36, 9, 25, 18, 41, 7],
                [15, 34, 6, 29, 13, 38],
                [42, 21, 39, 4, 27, 16],
                [10, 35, 20, 46, 1, 32],
            ]);
        });
    });

    describe('Special patterns', () => {
        it('should handle identity-like matrices (diagonal has highest values)', () => {
            test([
                [100, 1, 1],
                [1, 100, 1],
                [1, 1, 100],
            ], [0, 1, 2]); // Should pick the diagonal
        });

        it('should handle anti-diagonal pattern', () => {
            test([
                [1, 1, 100],
                [1, 100, 1],
                [100, 1, 1],
            ], [2, 1, 0]); // Should pick the anti-diagonal
        });

        it('should handle matrices with duplicate maximum values', () => {
            testOptimalSum([
                [50, 50, 10],
                [10, 50, 50],
                [50, 10, 50],
            ]);
        });

        it('should handle increasing sequences', () => {
            testOptimalSum([
                [1, 2, 3, 4],
                [2, 3, 4, 5],
                [3, 4, 5, 6],
                [4, 5, 6, 7],
            ]);
        });

        it('should handle decreasing sequences', () => {
            testOptimalSum([
                [7, 6, 5, 4],
                [6, 5, 4, 3],
                [5, 4, 3, 2],
                [4, 3, 2, 1],
            ]);
        });
    });

    describe('Performance and stress tests', () => {
        it('should handle larger matrices correctly', () => {
            const size = 10;
            const matrix = Array.from({ length: size }, (_, i) =>
                Array.from({ length: size }, (_, j) => Math.floor(Math.random() * 1000)),
            );

            testOptimalSum(matrix); // because it is 10x10 the result will still be checked against all permutations
        }, 1_000);

        it('should handle larger matrices efficiently', () => {
            const size = 500;
            const matrix = Array.from({ length: size }, (_, i) =>
                Array.from({ length: size }, (_, j) => Math.floor(Math.random() * 1000)),
            );

            testOptimalSum(matrix);
        }, 1_000);

        it('throws at 501 matrix', () => {
            const size = 501;
            const matrix = Array.from({ length: size }, (_, i) =>
                Array.from({ length: size }, (_, j) => Math.floor(Math.random() * 1000)),
            );

            expect(() => calculateHungarianAlgorithm(matrix)).toThrow('Too many items to process. Maximum is 500.');
        }, 1_000);

        it('should be deterministic (same input produces same output)', () => {
            const matrix = [
                [15, 23, 7, 31],
                [12, 8, 25, 19],
                [28, 16, 4, 22],
                [9, 33, 18, 5],
            ];

            const result1 = calculateHungarianAlgorithm(matrix);
            const result2 = calculateHungarianAlgorithm(matrix);
            const result3 = calculateHungarianAlgorithm(matrix);

            expect(result1).toEqual(result2);
            expect(result2).toEqual(result3);
        });
    });

    describe('Real-world scenarios', () => {
        it('should handle cost minimization by negating values', () => {
            // Original cost matrix (we want to minimize cost)
            const costMatrix = [
                [4, 6, 8],
                [2, 9, 1],
                [7, 3, 5],
            ];

            // Convert to maximization problem by negating
            const maxMatrix = costMatrix.map(row => row.map(val => -val));

            // Verify this gives minimum cost assignment
            test(maxMatrix, [
                0,
                2,
                1,
            ]);
        });

        it('should handle worker-task assignment scenario', () => {
            // Productivity scores for workers assigned to tasks
            const productivityMatrix = [
                [85, 92, 78, 88], // Worker 1's productivity on tasks 1-4
                [90, 76, 85, 82], // Worker 2's productivity on tasks 1-4
                [78, 88, 92, 85], // Worker 3's productivity on tasks 1-4
                [88, 85, 80, 90], // Worker 4's productivity on tasks 1-4
            ];

            testOptimalSum(productivityMatrix);
        });
    });

    describe('Boundary value testing', () => {
        it('should handle very large values', () => {
            testOptimalSum([
                [1000000, 999999, 1000001],
                [999998, 1000002, 999997],
                [1000003, 999996, 1000000],
            ]);
        });

        it('should handle small values', () => {
            testOptimalSum([
                [1, 2, 3],
                [2, 1, 4],
                [3, 4, 1],
            ]);
        });

        it('should handle zero and one combinations', () => {
            test([
                [0, 1, 0],
                [1, 0, 1],
                [0, 1, 0],
            ], [
                1, 0, 2, // Last one doesn't receive a discount (least priority)
            ]);
        });
    });
});
