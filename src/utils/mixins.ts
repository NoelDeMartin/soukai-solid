export function withMixins<T extends any>(baseClass: T, mixinClasses: any[]): T {
    const propertyDescriptors = mixinClasses.reduce((propertyDescriptors, mixinClass) => ({
        ...propertyDescriptors,
        ...Object.getOwnPropertyDescriptors(mixinClass.prototype),
    }), {}) as { [name: string]: PropertyDescriptor };

    for (const [propertyName, propertyDescriptor] of Object.entries(propertyDescriptors)) {
        Object.defineProperty(baseClass.prototype, propertyName, propertyDescriptor);
    }

    return baseClass;
}
