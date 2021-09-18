import Faker from 'faker';

import { readFileSync } from 'fs';

export function fakeDocumentUrl(): string {
    return Faker.internet.url();
}

export function fakeResourceUrl(hash: string = 'it'): string {
    return fakeDocumentUrl() + '#' + hash;
}

export function loadFixture(name: string): string {
    return readFileSync(`${__dirname}/../tests/fixtures/${name}`).toString();
}
