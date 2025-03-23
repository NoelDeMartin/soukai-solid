/* eslint-disable @typescript-eslint/no-var-requires */

import { installVitestSolidMatchers } from '@noeldemartin/solid-utils/testing';
import { FakeServer } from '@noeldemartin/testing';
import FakeSolidEngine from 'soukai-solid/testing/fakes/FakeSolidEngine';
import { beforeEach } from 'vitest';

import { bootSolidModels } from 'soukai-solid/models';

installVitestSolidMatchers();
beforeEach(() => {
    FakeServer.reset();
    FakeSolidEngine.reset();

    bootSolidModels();
});
