
export class Sorter {
    static byID( a: {id: number}, b: {id: number} ) {
        if ( a.id < b.id ){
            return -1;
        }
        if ( a.id > b.id ){
            return 1;
        }
        return 0;
    }
}