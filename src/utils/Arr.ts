class Arr {

    public last<T>(array: T[]): T {
        return array[array.length - 1];
    }

    public make<T>(length: number, value: T | any = null): T[] {
        return (new Array(length)).fill(value);
    }

    public unique<T>(array: T[], getId: ((i: T) => any) | null = null): T[] {
        const ids = array.map(item => getId ? getId(item) : item);

        return array.filter((item, index) => ids.indexOf(ids[index]) === index);
    }

}

export default new Arr();
