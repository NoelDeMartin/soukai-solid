import { DocumentAlreadyExists, DocumentNotFound, SoukaiError } from 'soukai';
import { fakeContainerUrl, fakeDocumentUrl, fakeResourceUrl } from '@noeldemartin/testing';
import {
    arrayZip,
    range,
    requireUrlParentDirectory,
    stringToSlug,
    urlResolve,
    urlResolveDirectory,
} from '@noeldemartin/utils';
import type { EngineFilters } from 'soukai';

import { faker } from '@noeldemartin/faker';

import { SolidEngine } from '@/engines/SolidEngine';

import ChangeUrlOperation from '@/solid/operations/ChangeUrlOperation';
import IRI from '@/solid/utils/IRI';
import RDFDocument from '@/solid/RDFDocument';
import RDFResourceProperty from '@/solid/RDFResourceProperty';
import RemovePropertyOperation from '@/solid/operations/RemovePropertyOperation';
import UpdatePropertyOperation from '@/solid/operations/UpdatePropertyOperation';
import { LDP_CONTAINER } from '@/solid/constants';
import type { Fetch } from '@/solid/SolidClient';

import SolidClientMock from '@/solid/__mocks__';

import { jsonLDGraph, stubMoviesCollectionJsonLD, stubPersonJsonLD } from '@/testing/lib/stubs/helpers';

describe('SolidEngine', () => {

    let engine: SolidEngine;

    beforeEach(() => {
        SolidClientMock.reset();

        // TODO use dependency injection instead of doing this
        engine = new SolidEngine(null as unknown as Fetch);
        (engine as unknown as { client: typeof SolidClientMock }).client = SolidClientMock;
    });

    it('creates one document', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const personUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const name = faker.name.firstName();
        const date = new Date('1997-07-21T23:42:00Z');
        const jsonld = stubPersonJsonLD(personUrl, name, { birthDate: '1997-07-21T23:42:00.000Z' });

        // Act
        const id = await engine.create(containerUrl, jsonld, personUrl);

        // Assert
        expect(id).toEqual(personUrl);

        expect(SolidClientMock.createDocument).toHaveBeenCalledWith(
            containerUrl,
            personUrl,
            expect.anything(),
            {},
        );

        const properties = SolidClientMock.createDocumentSpy.mock.calls[0]?.[2];

        expect(properties).toHaveLength(3);
        expect(properties).toContainEqual(RDFResourceProperty.type(personUrl, IRI('foaf:Person')));
        expect(properties).toContainEqual(RDFResourceProperty.literal(personUrl, IRI('foaf:name'), name, name));
        expect(properties).toContainEqual(
            RDFResourceProperty.literal(personUrl, IRI('foaf:birthdate'), date, '1997-07-21T23:42:00.000Z'),
        );
    });

    it('creates one container', async () => {
        // Arrange
        const name = faker.name.firstName();
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, stringToSlug(name));

        // Act
        const id = await engine.create(
            requireUrlParentDirectory(documentUrl),
            stubMoviesCollectionJsonLD(documentUrl, name),
            documentUrl,
        );

        // Assert
        expect(id).toEqual(documentUrl);

        expect(SolidClientMock.createDocument).toHaveBeenCalledWith(
            parentUrl,
            documentUrl,
            expect.anything(),
            {},
        );

        const properties = SolidClientMock.createDocumentSpy.mock.calls[0]?.[2];

        expect(properties).toHaveLength(2);
        expect(properties).toContainEqual(RDFResourceProperty.type(documentUrl, LDP_CONTAINER));
        expect(properties).toContainEqual(RDFResourceProperty.literal(documentUrl, IRI('rdfs:label'), name, name));
    });

    it('fails creating documents if the provided url is already in use', async () => {
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, faker.datatype.uuid());

        await SolidClientMock.createDocument(parentUrl, documentUrl, [
            RDFResourceProperty.type(documentUrl, IRI('foaf:Person')),
        ]);

        await expect(engine.create(parentUrl, jsonLDGraph(), documentUrl))
            .rejects
            .toBeInstanceOf(DocumentAlreadyExists);
    });

    it('gets one document', async () => {
        // Arrange
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, faker.datatype.uuid());
        const name = faker.name.firstName();

        await SolidClientMock.createDocument(parentUrl, documentUrl, [
            RDFResourceProperty.type(documentUrl, LDP_CONTAINER),
            RDFResourceProperty.literal(documentUrl, IRI('rdfs:label'), name),
        ]);

        // Act
        const document = await engine.readOne(requireUrlParentDirectory(documentUrl), documentUrl);

        // Assert
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(documentUrl);

        await expect(document).toEqualJsonLD(stubMoviesCollectionJsonLD(documentUrl, name));
    });

    it('fails reading when document doesn\'t exist', async () => {
        const documentUrl = urlResolve(faker.internet.url(), faker.datatype.uuid());

        await expect(engine.readOne(requireUrlParentDirectory(documentUrl), documentUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

    it('gets many documents', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const firstDocumentUrl = urlResolve(containerUrl, 'first');
        const secondDocumentUrl = urlResolve(containerUrl, 'second');
        const thirdDocumentUrl = urlResolve(containerUrl, 'third');
        const firstPersonUrl = `${firstDocumentUrl}#it`;
        const secondPersonUrl = `${secondDocumentUrl}#it`;
        const thirdPersonUrl = `${secondDocumentUrl}#${faker.datatype.uuid()}`;
        const groupUrl = `${thirdDocumentUrl}#it`;
        const firstPersonName = faker.name.firstName();
        const secondPersonName = faker.name.firstName();
        const thirdPersonName = faker.name.firstName();

        await SolidClientMock.createDocument(containerUrl, firstPersonUrl, [
            RDFResourceProperty.type(firstPersonUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstPersonUrl, IRI('foaf:name'), firstPersonName),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondPersonUrl, [
            RDFResourceProperty.type(secondPersonUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondPersonUrl, IRI('foaf:name'), secondPersonName),
            RDFResourceProperty.type(thirdPersonUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(thirdPersonUrl, IRI('foaf:name'), thirdPersonName),
        ]);

        await SolidClientMock.createDocument(containerUrl, thirdPersonUrl, [
            RDFResourceProperty.type(groupUrl, IRI('foaf:Group')),
        ]);

        // Act
        const documents = await engine.readMany(containerUrl, modelFilters(['foaf:Person']));

        // Assert
        expect(Object.keys(documents)).toHaveLength(2);
        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);

        const secondPerson = stubPersonJsonLD(secondPersonUrl, secondPersonName);
        const thirdPerson = stubPersonJsonLD(thirdPersonUrl, thirdPersonName);

        await expect(documents[firstPersonUrl]).toEqualJsonLD(stubPersonJsonLD(firstPersonUrl, firstPersonName));
        await expect(documents[secondPersonUrl]).toEqualJsonLD({
            '@graph': [
                secondPerson['@graph'][0],
                thirdPerson['@graph'][0],
            ],
        });
    });

    it('gets many documents using $in filter', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const missingDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const firstDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const secondDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const thirdDocumentUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const firstPersonName = faker.name.firstName();
        const secondPersonName = faker.name.firstName();
        const thirdPersonName = faker.name.firstName();
        const firstPersonUrl = `${firstDocumentUrl}#it`;
        const secondPersonUrl = `${secondDocumentUrl}#it`;
        const thirdPersonUrl = `${secondPersonUrl}#${faker.datatype.uuid()}`;

        await SolidClientMock.createDocument(containerUrl, firstDocumentUrl, [
            RDFResourceProperty.type(firstPersonUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstPersonUrl, IRI('foaf:name'), firstPersonName),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondDocumentUrl, [
            RDFResourceProperty.type(secondPersonUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondPersonUrl, IRI('foaf:name'), secondPersonName),
            RDFResourceProperty.type(thirdPersonUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(thirdPersonUrl, IRI('foaf:name'), thirdPersonName),
        ]);

        await SolidClientMock.createDocument(containerUrl, thirdDocumentUrl, [
            RDFResourceProperty.type(`${thirdDocumentUrl}#it`, IRI('foaf:Group')),
        ]);

        // Act
        const documents = await engine.readMany(containerUrl, {
            $in: [missingDocumentUrl, firstDocumentUrl, secondDocumentUrl, thirdDocumentUrl],
            ...modelFilters(['foaf:Person']),
        });

        // Assert
        expect(Object.keys(documents)).toHaveLength(2);

        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(missingDocumentUrl);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(firstDocumentUrl);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(secondDocumentUrl);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(thirdDocumentUrl);

        const secondPerson = stubPersonJsonLD(secondPersonUrl, secondPersonName);
        const thirdPerson = stubPersonJsonLD(thirdPersonUrl, thirdPersonName);

        await expect(documents[firstDocumentUrl]).toEqualJsonLD(stubPersonJsonLD(firstPersonUrl, firstPersonName));
        await expect(documents[secondDocumentUrl]).toEqualJsonLD({
            '@graph': [
                secondPerson['@graph'][0],
                thirdPerson['@graph'][0],
            ],
        });
    });

    it('gets many containers passing onlyContainers flag to client', async () => {
        // Arrange
        const parentUrl = urlResolveDirectory(faker.internet.url());
        const containerName = faker.lorem.word();
        const containerUrl = urlResolveDirectory(parentUrl, stringToSlug(containerName));

        await SolidClientMock.createDocument(parentUrl, containerUrl, [
            RDFResourceProperty.type(containerUrl, LDP_CONTAINER),
            RDFResourceProperty.literal(containerUrl, IRI('rdfs:label'), containerName),
        ]);

        // Act
        const documents = await engine.readMany(parentUrl, modelFilters(['ldp:Container']));

        // Assert
        expect(Object.keys(documents)).toHaveLength(1);
        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(parentUrl, true);

        await expect(documents[containerUrl]).toEqualJsonLD({
            '@graph': [{
                '@id': containerUrl,
                '@type': LDP_CONTAINER,
                [IRI('rdfs:label')]: containerName,
            }],
        });
    });

    it('gets many documents filtering by attributes', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const name = faker.name.firstName();
        const firstUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const secondUrl = urlResolve(containerUrl, faker.datatype.uuid());

        await SolidClientMock.createDocument(containerUrl, firstUrl, [
            RDFResourceProperty.type(firstUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstUrl, IRI('foaf:name'), name),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondUrl, [
            RDFResourceProperty.type(secondUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondUrl, IRI('foaf:name'), faker.name.firstName()),
        ]);

        // Act
        const documents = await engine.readMany(
            containerUrl,
            modelFilters(['foaf:Person'], { [IRI('foaf:name')]: name }),
        );

        // Assert
        expect(Object.keys(documents)).toHaveLength(1);
        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);

        await expect(documents[firstUrl]).toEqualJsonLD(stubPersonJsonLD(firstUrl, name));
    });

    it('gets many documents using globbing for $in filter', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const documentsCount = 10;
        const urls: string[] = [];
        const names: string[] = [];

        engine.setConfig({ useGlobbing: true });

        await Promise.all(range(documentsCount).map(async i => {
            const url = urlResolve(containerUrl, `document-${i}`);
            const name = faker.name.firstName();

            urls.push(url);
            names.push(name);

            await SolidClientMock.createDocument(containerUrl, url, [
                RDFResourceProperty.type(url, IRI('foaf:Person')),
                RDFResourceProperty.literal(url, IRI('foaf:name'), name),
            ]);
        }));

        // Act
        const documents = await engine.readMany(containerUrl, {
            $in: urls,
            ...modelFilters(['foaf:Person']),
        });

        // Assert
        expect(Object.keys(documents)).toHaveLength(documentsCount);
        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);

        await Promise.all(
            arrayZip(urls, names).map(
                ([url, name]) => expect(documents[url as string])
                    .toEqualJsonLD(stubPersonJsonLD(url as string, name as string)),
            ),
        );
    });

    it('gets many documents with the legacy "document root" format', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const firstUrl = urlResolve(containerUrl, 'first');
        const secondUrl = urlResolve(containerUrl, 'second');
        const thirdUrl = `${secondUrl}#${faker.datatype.uuid()}`;
        const firstName = faker.name.firstName();
        const secondName = faker.name.firstName();
        const thirdName = faker.name.firstName();

        await SolidClientMock.createDocument(containerUrl, firstUrl, [
            RDFResourceProperty.type(firstUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstUrl, IRI('foaf:name'), firstName),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondUrl, [
            RDFResourceProperty.type(secondUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondUrl, IRI('foaf:name'), secondName),
            RDFResourceProperty.type(thirdUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(thirdUrl, IRI('foaf:name'), thirdName),
        ]);

        // Act
        const documents = await engine.readMany(containerUrl, modelFilters(['foaf:Person']));

        // Assert
        expect(Object.keys(documents)).toHaveLength(2);
        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);

        const secondPerson = stubPersonJsonLD(secondUrl, secondName);
        const thirdPerson = stubPersonJsonLD(thirdUrl, thirdName);

        await expect(documents[firstUrl]).toEqualJsonLD(stubPersonJsonLD(firstUrl, firstName));
        await expect(documents[secondUrl]).toEqualJsonLD({
            '@graph': [
                secondPerson['@graph'][0],
                thirdPerson['@graph'][0],
            ],
        });
    });

    it('gets many documents using $in filter with the legacy "document root" format', async () => {
        // Arrange
        const containerUrl = urlResolveDirectory(faker.internet.url());
        const brokenUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const firstName = faker.name.firstName();
        const firstUrl = urlResolve(containerUrl, faker.datatype.uuid());
        const secondName = faker.name.firstName();
        const secondUrl = urlResolve(containerUrl, faker.datatype.uuid());

        await SolidClientMock.createDocument(containerUrl, firstUrl, [
            RDFResourceProperty.type(firstUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstUrl, IRI('foaf:name'), firstName),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondUrl, [
            RDFResourceProperty.type(secondUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondUrl, IRI('foaf:name'), secondName),
        ]);

        // Act
        const documents = await engine.readMany(containerUrl, {
            $in: [brokenUrl, firstUrl, secondUrl],
            ...modelFilters(['foaf:Person']),
        });

        // Assert
        expect(Object.keys(documents)).toHaveLength(2);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(firstUrl);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(secondUrl);

        await expect(documents[firstUrl]).toEqualJsonLD(stubPersonJsonLD(firstUrl, firstName));
        await expect(documents[secondUrl]).toEqualJsonLD(stubPersonJsonLD(secondUrl, secondName));
    });

    it('updates document updated attributes', async () => {
        // Arrange
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, faker.datatype.uuid());
        const name = faker.random.word();
        const date = new Date();

        await SolidClientMock.createDocument(parentUrl, documentUrl);

        // Act
        await engine.update(
            parentUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: {
                        $where: { '@id': documentUrl },
                        $update: {
                            [IRI('foaf:name')]: name,
                            [IRI('purl:modified')]: {
                                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                                '@value': date.toISOString(),
                            },
                        },
                    },
                },
            },
        );

        // Assert
        expect(SolidClientMock.updateDocument).toHaveBeenCalledWith(
            documentUrl,
            [
                new UpdatePropertyOperation(RDFResourceProperty.literal(documentUrl, IRI('foaf:name'), name)),
                new UpdatePropertyOperation(RDFResourceProperty.literal(documentUrl, IRI('purl:modified'), date)),
            ],
            {},
        );
    });

    it('updates document removed attributes', async () => {
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, faker.datatype.uuid());

        await SolidClientMock.createDocument(parentUrl, documentUrl);

        await engine.update(
            parentUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: {
                        $where: { '@id': documentUrl },
                        $update: { [IRI('foaf:name')]: { $unset: true } },
                    },
                },
            },
        );

        expect(SolidClientMock.updateDocument).toHaveBeenCalledWith(
            documentUrl,
            [new RemovePropertyOperation(documentUrl, IRI('foaf:name'))],
            {},
        );
    });

    it('updates document removing resources', async () => {
        // Arrange
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, faker.datatype.uuid());
        const firstResourceUrl = `${documentUrl}#one`;
        const secondResourceUrl = `${documentUrl}#two`;

        await SolidClientMock.createDocument(parentUrl, documentUrl);

        // Act
        await engine.update(
            parentUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: {
                        $where: { '@id': { $in: [firstResourceUrl, secondResourceUrl] } },
                        $unset: true,
                    },
                },
            },
        );

        // Assert
        expect(SolidClientMock.updateDocument).toHaveBeenCalledWith(
            documentUrl,
            [
                new RemovePropertyOperation(firstResourceUrl),
                new RemovePropertyOperation(secondResourceUrl),
            ],
            {},
        );
    });

    it('updates document changing resource urls', async () => {
        // Arrange
        const legacyParentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const legacyDocumentUrl = urlResolve(legacyParentUrl, faker.datatype.uuid());
        const parentUrl = urlResolveDirectory(faker.internet.url(), stringToSlug(faker.random.word()));
        const documentUrl = urlResolve(parentUrl, faker.datatype.uuid());
        const firstResourceUrl = legacyDocumentUrl;
        const secondResourceUrl = `${legacyDocumentUrl}#something-else`;
        const newFirstResourceUrl = `${documentUrl}#it`;
        const newSecondResourceUrl = `${documentUrl}#something-else`;

        await SolidClientMock.createDocument(parentUrl, documentUrl);

        // Act
        await engine.update(
            parentUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: [
                        {
                            $where: { '@id': firstResourceUrl },
                            $update: { '@id': newFirstResourceUrl },
                        },
                        {
                            $where: { '@id': secondResourceUrl },
                            $update: {
                                '@id': newSecondResourceUrl,
                                'reference': { '@id': newFirstResourceUrl },
                            },
                        },
                    ],
                },
            },
        );

        // Assert
        expect(SolidClientMock.updateDocument).toHaveBeenCalledWith(
            documentUrl,
            [
                new ChangeUrlOperation(firstResourceUrl, newFirstResourceUrl),
                new ChangeUrlOperation(secondResourceUrl, newSecondResourceUrl),
                new UpdatePropertyOperation(
                    RDFResourceProperty.reference(secondResourceUrl, 'reference', newFirstResourceUrl),
                ),
            ],
            {},
        );
    });

    it('fails updating when document doesn\'t exist', async () => {
        const documentUrl = urlResolve(faker.internet.url(), faker.datatype.uuid());

        await expect(engine.readOne(requireUrlParentDirectory(documentUrl), documentUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

    it('fails when attributes are not a JSON-LD graph', async () => {
        await expect(engine.create('', {}, '')).rejects.toBeInstanceOf(SoukaiError);
        await expect(engine.update('', '', {})).rejects.toBeInstanceOf(SoukaiError);
    });

    it('caches documents', async () => {
        // Arrange
        const containerUrl = fakeContainerUrl();
        const documentUrl = fakeDocumentUrl({ containerUrl });
        const person = stubPersonJsonLD(fakeResourceUrl({ documentUrl }), 'John Doe');
        const { properties } = await RDFDocument.fromJsonLD(person);

        await SolidClientMock.createDocument(containerUrl, documentUrl, properties);

        engine.setConfig({ cachesDocuments: true });

        // Act
        const results = [
            await engine.readOne(containerUrl, documentUrl),
            await engine.readOne(containerUrl, documentUrl),
            (await engine.readMany(containerUrl, { $in: [documentUrl] }))[documentUrl],
            (await engine.readMany(containerUrl, { $in: [documentUrl] }))[documentUrl],
        ];

        // Assert
        expect(results).toHaveLength(4);

        results.forEach(result => expect(result).toEqualJsonLD(person));

        expect(SolidClientMock.getDocument).toHaveBeenCalledTimes(1);
    });

});

function modelFilters(types: string[], extraFilters: Record<string, unknown> = {}): EngineFilters {
    const expandedTypes = types.map(type => IRI(type));

    return {
        '@graph': {
            $contains: {
                '@type': {
                    $or: [
                        { $contains: types },
                        { $contains: expandedTypes },
                        ...(
                            types.length === 1
                                ? [
                                    { $eq: types[0] as string },
                                    { $eq: expandedTypes[0] as string },
                                ]
                                : []
                        ),
                    ],
                },
                ...extraFilters,
            },
        },
    };
}
