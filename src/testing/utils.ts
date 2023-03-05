import { faker } from '@noeldemartin/faker';
import { readFileSync } from 'fs';
import { stringToSlug } from '@noeldemartin/utils';
import type { Constructor } from '@noeldemartin/utils';

interface ContainerOptions {
    baseUrl: string;
}

interface DocumentOptions extends ContainerOptions {
    containerUrl: string;
    name: string;
}

interface ResourceOptions extends DocumentOptions {
    documentUrl: string;
    hash: string;
}

export function assertInstanceOf<T>(
    object: unknown,
    constructor: Constructor<T>,
    assert: (instance: T) => void,
): void {
    expect(object).toBeInstanceOf(constructor);

    assert(object as T);
}

export function fakeContainerUrl(options: Partial<ContainerOptions> = {}): string {
    const baseUrl = options.baseUrl ?? faker.internet.url();

    return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function fakeDocumentUrl(options: Partial<DocumentOptions> = {}): string {
    const containerUrl = options.containerUrl ?? fakeContainerUrl(options);
    const name = options.name ?? faker.random.word();

    return containerUrl + stringToSlug(name);
}

export function fakeResourceUrl(options: Partial<ResourceOptions> = {}): string {
    const documentUrl = options.documentUrl ?? fakeDocumentUrl(options);
    const hash = options.hash ?? 'it';

    return documentUrl + '#' + hash;
}

export function loadFixture<T = string>(name: string): T {
    const raw = readFileSync(`${__dirname}/../tests/fixtures/${name}`).toString();

    return /\.json(ld)$/.test(name)
        ? JSON.parse(raw)
        : raw;
}
