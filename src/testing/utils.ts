import Faker from 'faker';
import { stringToSlug } from '@noeldemartin/utils';

import { readFileSync } from 'fs';

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

export function fakeContainerUrl(options: Partial<ContainerOptions> = {}): string {
    const baseUrl = options.baseUrl ?? Faker.internet.url();

    return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function fakeDocumentUrl(options: Partial<DocumentOptions> = {}): string {
    const containerUrl = options.containerUrl ?? fakeContainerUrl(options);
    const name = options.name ?? Faker.random.word();

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
