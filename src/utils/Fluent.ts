/* eslint-disable @typescript-eslint/ban-types */
type Tapped<Target extends object> = {
    [prop in keyof Target]: Target[prop] extends (...params: infer Params) => any
        ? (...params: Params) => Tapped<Target>
        : Target[prop];
};

class Fluent {

    public tap<Target extends object>(target: Target): Tapped<Target>;
    public tap<Target extends object>(target: Target, callback: (target: Target) => any): Target;
    public tap<Target extends object>(
        target: Target,
        callback?: (target: Target) => any,
    ): Target | Tapped<Target> {
        if (!callback)
            return this.proxyTap(target);

        callback(target);

        return target;
    }

    private proxyTap<Target extends object>(target: Target): Tapped<Target> {
        const proxy = new Proxy(target, {
            get(target: object, key: PropertyKey, receiver?: any) {
                const prop = Reflect.get(target, key, receiver);

                if (typeof prop !== 'function')
                    return prop;

                return (...params: any[]) => {
                    prop.call(target, ...params);

                    return proxy;
                };
            },
        }) as Tapped<Target>;

        return proxy;
    }

}

export default new Fluent();
