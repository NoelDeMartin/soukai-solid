import Faker from 'faker';

import { readFileSync } from 'fs';

export function loadFixture(name: string): string {
    return readFileSync(`${__dirname}/../tests/fixtures/${name}`).toString();
}

export function fakeResourceUrl(): string {
    return Faker.internet.url() + '#it';
}
