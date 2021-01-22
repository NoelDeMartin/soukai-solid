export type MapObject<T> = { [key: string] : T };

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type ValueWithoutEmpty<T> = T extends null ? never : T;
type ReplaceEmpty<T> = { [K in keyof T]: ValueWithoutEmpty<T[K]> };
type GetRequiredKeysWithoutEmpty<T, U extends Record<keyof T, unknown> = ReplaceEmpty<T>> = {
    [K in keyof T]:
        {} extends Pick<T, K>
            ? never
            : (
                U[K] extends never
                    ? never
                    : (Equal<T[K], U[K]> extends true ? K : never)
            )
}[keyof T];
type GetOptionalKeysWithoutEmpty<T, U extends Record<keyof T, unknown> = ReplaceEmpty<T>> = {
    [K in keyof T]:
        {} extends Pick<T, K>
            ? K
            : (
                U[K] extends never
                ? never
                : (Equal<T[K], U[K]> extends true ? never : K)
            )
}[keyof T];

// Given an existing bug in TypeScript, it's not possible to define optional keys using type generics without having
// them defined as `| undefined` as well. Until that is fixed, this may cause some problems for keys that can have
// empty values but not always do.
// See https://github.com/microsoft/TypeScript/issues/13195
type ObjectWithoutEmpty<T> =
    { [K in GetRequiredKeysWithoutEmpty<T>]: ValueWithoutEmpty<T[K]> } &
    { [K in GetOptionalKeysWithoutEmpty<T>]?: ValueWithoutEmpty<T[K]> }

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

    withoutEmpty<T>(obj: T): ObjectWithoutEmpty<T> {
        const cleanObj = {};

        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined)
                continue;

            cleanObj[key] = value;
        }

        return cleanObj as ObjectWithoutEmpty<T>;
    }

}

export default new Obj();
