export type MapObject<T> = { [key: string] : T };

type WithoutEmpty<T> = {
    [k in keyof T]: T[k] extends undefined ? never : T[k];
}

class Obj {

    createMap<T>(items: T[], key: string): MapObject<T> {
        const map = {};

        for (const item of items)
            map[item[key]] = item;

        return map;
    }

    deepEquals(a: any, b: any): boolean {
        if (a === b) {
            return true;
        }

        const typeOfA = typeof a;
        if (typeOfA !== typeof b) {
            return false;
        }

        if (typeOfA !== 'object' || a === null || b === null) {
            return false;
        }

        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }

        if (Object.keys(a).length !== Object.keys(b).length) {
            return false;
        }

        for (const key in a) {
            if (!this.deepEquals(a[key], b[key])) {
                return false;
            }
        }

        return true;
    }

    withoutEmpty<T>(obj: T): WithoutEmpty<T> {
        const cleanObj = {};

        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined)
                continue;

            cleanObj[key] = value;
        }

        return cleanObj as WithoutEmpty<T>;
    }

}

export default new Obj();
