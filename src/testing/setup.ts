/* eslint-disable @typescript-eslint/no-var-requires */

import { installJestPlugin } from '@noeldemartin/solid-utils';

import { bootSolidModels } from '@/models';

installJestPlugin();
beforeEach(() => jest.clearAllMocks());
beforeEach(() => bootSolidModels());

process.on('unhandledRejection', (err) => fail(err));
