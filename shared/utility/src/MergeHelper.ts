type IfEquals<X, Y, A=X, B=never> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? A : B;

type WritableKeys<T> = {
    [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P>
  }[keyof T];

  export type OnlyWritabelKeys<T> = Pick<T, WritableKeys<T>>; 

 function mergeChange<T>(original: T, toMerge: T, changes: Partial<OnlyWritabelKeys<T>>,key: keyof OnlyWritabelKeys<T>, checkEmpty = false) {
    const newValue = toMerge[key];
    const originalValue = original[key];

    if(checkEmpty) {
        if(typeof newValue === 'string') {
            if(newValue.length < 1) return;
        }
    }

    if(newValue !== originalValue) {
        forceChange(original, toMerge, changes, key);
    }
}

 function forceChange<T>(original: T, toMerge: T, changes: Partial<OnlyWritabelKeys<T>>,key: keyof OnlyWritabelKeys<T>) {
    const newValue = toMerge[key] as any;
    changes[key] = newValue;
    original[key] = newValue;
}


 export const MergeHelper = {
    forceChange,
    mergeChange
}
