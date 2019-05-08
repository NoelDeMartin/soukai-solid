class Arr {

    public last<T>(array: T[]): T {
        return array[array.length - 1];
    }

    public make<T>(length: number, value: T | any = null): T[] {
        return (new Array(length)).fill(value);
    }

    public unique<T>(array: T[]): T[] {
        return array.filter((item: T, index: number) => array.indexOf(item) === index);
    }

}

export default new Arr();
