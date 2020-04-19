export type MapObject<T> = { [key: string] : T };

class Obj {

    createMap<T>(items: T[], key: string): MapObject<T> {
        const map = {};

        for (const item of items)
            map[item[key]] = item;

        return map;
    }

}

export default new Obj();
