
export class Sorter {
    static byID( a: {id: string}, b: {id: string} ) {
        if ( a.id < b.id ){
            return -1;
        }
        if ( a.id > b.id ){
            return 1;
        }
        return 0;
    }
}