class Arr {

    public clean<T>(items: (T | null)[]): T[] {
        return items.filter(item => !!item) as T[];
    }

    public contains<T>(items: T[], item: T): boolean {
        return items.indexOf(item) !== -1;
    }

    public flatten<T>(items: T[][]): T[] {
        return items.reduce((flattenedItems, nestedItems) => [...flattenedItems, ...nestedItems], []);
    }

    public last<T>(items: T[]): T {
        return items[items.length - 1];
    }

    public make<T>(length: number, value: T | any = null): T[] {
        return (new Array(length)).fill(value);
    }

    public range(length: number): number[] {
        const items: number[] = [];

        for (let i = 0; i < length; i++)
            items.push(i);

        return items;
    }

    public removeItem<T>(items: T[], item: T): T {
        const index = items.indexOf(item);

        if (index !== -1)
            items.splice(index, 1);

        return item;
    }

    public unique<T>(items: T[], getId: ((i: T) => any) | null = null): T[] {
        const ids = items.map(item => getId ? getId(item) : item);

        return items.filter((_, index) => ids.indexOf(ids[index]) === index);
    }

    public without<T>(items: T[], exclude: T[]): T[] {
        return items.filter(item => exclude.indexOf(item) === -1);
    }

    public zip<T>(...arrays: T[][]): T[][] {
        const zippedArrays: T[][] = [];

        for (let i = 0; i < arrays[0].length; i++)
        zippedArrays.push(arrays.map(a => a[i]));

        return zippedArrays;
    }

}

export default new Arr();
