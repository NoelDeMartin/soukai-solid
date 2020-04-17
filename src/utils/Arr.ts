class Arr {

    public flatten<T>(array: T[][]): T[] {
        return array.reduce((flattenedItems, nestedItems) => [...flattenedItems, ...nestedItems], []);
    }

    public last<T>(array: T[]): T {
        return array[array.length - 1];
    }

    public make<T>(length: number, value: T | any = null): T[] {
        return (new Array(length)).fill(value);
    }

    public range(length: number): number[] {
        const array: number[] = [];

        for (let i = 0; i < length; i++)
            array.push(i);

        return array;
    }

    public unique<T>(array: T[], getId: ((i: T) => any) | null = null): T[] {
        const ids = array.map(item => getId ? getId(item) : item);

        return array.filter((_, index) => ids.indexOf(ids[index]) === index);
    }

    public zip<T>(...arrays: T[][]): T[][] {
        const array: T[][] = [];

        for (let i = 0; i < arrays[0].length; i++)
            array.push(arrays.map(a => a[i]));

        return array;
    }

}

export default new Arr();
