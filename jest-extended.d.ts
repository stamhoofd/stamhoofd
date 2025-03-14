import "jest-extended";

declare global {
    namespace jest {
        interface AsymmetricMatchers {
            toMatchMap(map: Map<any, any>): void;
        }

        interface Matchers<R> {
            toMatchMap(map: Map<any, any>): R;
        }
    }
}
export {  };
