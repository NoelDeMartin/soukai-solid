import 'fake-indexeddb/auto';

import { DocumentNotFound, DocumentAlreadyExists, SoukaiError, EngineFilters } from 'soukai';

import Faker from 'faker';

import SolidEngine from '@/engines/SolidEngine';

import RDF, { IRI } from '@/solid/utils/RDF';
import RDFResourceProperty from '@/solid/RDFResourceProperty';

import Str from '@/utils/Str';
import Url from '@/utils/Url';
import Arr from '@/utils/Arr';

import SolidClientMock from '@/solid/__mocks__';

import { stubPersonJsonLD, stubGroupJsonLD, jsonLDGraph } from '@tests/stubs/helpers';

let engine: SolidEngine;

describe('SolidEngine', () => {

    beforeEach(() => {
        SolidClientMock.reset();

        // TODO use dependency injection instead of doing this
        engine = new SolidEngine(null as any);
        (engine as any).client = SolidClientMock;
    });

    it('creates one document', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const personUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const name = Faker.name.firstName();
        const date = new Date('1997-07-21T23:42:00Z');
        const jsonld = stubPersonJsonLD(personUrl, name, '1997-07-21T23:42:00.000Z');

        // Act
        const id = await engine.create(containerUrl, jsonld, personUrl);

        // Assert
        expect(id).toEqual(personUrl);

        expect(SolidClientMock.createDocument).toHaveBeenCalledWith(
            containerUrl,
            personUrl,
            expect.anything(),
        );

        const properties = (SolidClientMock.createDocument as any).mock.calls[0][2];

        expect(properties).toHaveLength(3);
        expect(properties).toContainEqual(RDFResourceProperty.type(personUrl, IRI('foaf:Person')));
        expect(properties).toContainEqual(RDFResourceProperty.literal(personUrl, IRI('foaf:name'), name));
        expect(properties).toContainEqual(RDFResourceProperty.literal(personUrl, IRI('foaf:birthdate'), date));
    });

    it('creates one container', async () => {
        // Arrange
        const name = Faker.name.firstName();
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Str.slug(name));

        // Act
        const id = await engine.create(
            Url.parentDirectory(documentUrl),
            stubGroupJsonLD(documentUrl, name),
            documentUrl,
        );

        // Assert
        expect(id).toEqual(documentUrl);

        expect(SolidClientMock.createDocument).toHaveBeenCalledWith(
            parentUrl,
            documentUrl,
            expect.anything(),
        );

        const properties = (SolidClientMock.createDocument as any).mock.calls[0][2];

        expect(properties).toHaveLength(3);
        expect(properties).toContainEqual(RDFResourceProperty.type(documentUrl, IRI('ldp:Container')));
        expect(properties).toContainEqual(RDFResourceProperty.type(documentUrl, IRI('foaf:Group')));
        expect(properties).toContainEqual(RDFResourceProperty.literal(documentUrl, IRI('foaf:name'), name));
    });

    it('fails creating documents if the provided url is already in use', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());

        await SolidClientMock.createDocument(parentUrl, documentUrl, [
            RDFResourceProperty.type(documentUrl, IRI('foaf:Person')),
        ]);

        await expect(engine.create(parentUrl, jsonLDGraph(), documentUrl))
            .rejects
            .toBeInstanceOf(DocumentAlreadyExists);
    });

    it('gets one document', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const name = Faker.name.firstName();

        await SolidClientMock.createDocument(parentUrl, documentUrl, [
            RDFResourceProperty.type(documentUrl, IRI('ldp:Container')),
            RDFResourceProperty.type(documentUrl, IRI('foaf:Group')),
            RDFResourceProperty.literal(documentUrl, IRI('foaf:name'), name),
        ]);

        // Act
        const document = await engine.readOne(Url.parentDirectory(documentUrl), documentUrl);

        // Assert
        expect(document).toEqualJsonLD(stubGroupJsonLD(documentUrl, name));

        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(documentUrl);
    });

    it("fails reading when document doesn't exist", async () => {
        const documentUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await expect(engine.readOne(Url.parentDirectory(documentUrl), documentUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

    it('gets many documents', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const firstUrl = Url.resolve(containerUrl, 'first');
        const secondUrl = Url.resolve(containerUrl, 'second');
        const thirdUrl = `${secondUrl}#${Faker.random.uuid()}`;
        const firstName = Faker.name.firstName();
        const secondName = Faker.name.firstName();
        const thirdName = Faker.name.firstName();

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

        await expect(documents[firstUrl]).toEqualJsonLD(stubPersonJsonLD(firstUrl, firstName));

        const secondPerson = stubPersonJsonLD(secondUrl, secondName);
        const thirdPerson = stubPersonJsonLD(thirdUrl, thirdName);
        await expect(documents[secondUrl]).toEqualJsonLD({
            '@graph': [
                secondPerson['@graph'][0],
                thirdPerson['@graph'][0],
            ],
        });

        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);
    });

    it('gets many containers passing onlyContainers flag to client', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url());
        const containerName = Faker.lorem.word();
        const containerUrl = Url.resolveDirectory(parentUrl, Str.slug(containerName));

        await SolidClientMock.createDocument(parentUrl, containerUrl, [
            RDFResourceProperty.type(containerUrl, IRI('ldp:Container')),
            RDFResourceProperty.literal(containerUrl, IRI('rdfs:label'), containerName),
        ]);

        // Act
        const documents = await engine.readMany(parentUrl, modelFilters(['ldp:Container']));

        // Assert
        expect(Object.keys(documents)).toHaveLength(1);

        await expect(documents[containerUrl]).toEqualJsonLD({
            '@graph': [{
                '@id': containerUrl,
                '@type': IRI('ldp:Container'),
                [IRI('rdfs:label')]: containerName,
            }],
        });

        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(parentUrl, true);
    });

    it('gets many documents filtering by attributes', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const name = Faker.name.firstName();
        const firstUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const secondUrl = Url.resolve(containerUrl, Faker.random.uuid());

        await SolidClientMock.createDocument(containerUrl, firstUrl, [
            RDFResourceProperty.type(firstUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstUrl, IRI('foaf:name'), name),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondUrl, [
            RDFResourceProperty.type(secondUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondUrl, IRI('foaf:name'), Faker.name.firstName()),
        ]);

        // Act
        const documents = await engine.readMany(
            containerUrl,
            modelFilters(['foaf:Person'], { [IRI('foaf:name')]: name }),
        );

        // Assert
        expect(Object.keys(documents)).toHaveLength(1);
        expect(documents[firstUrl]).toEqualJsonLD(stubPersonJsonLD(firstUrl, name));
        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);
    });

    it('gets many documents using $in filter', async () => {
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const brokenUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const firstName = Faker.name.firstName();
        const firstUrl = Url.resolve(containerUrl, Faker.random.uuid());
        const secondName = Faker.name.firstName();
        const secondUrl = Url.resolve(containerUrl, Faker.random.uuid());

        await SolidClientMock.createDocument(containerUrl, firstUrl, [
            RDFResourceProperty.type(firstUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(firstUrl, IRI('foaf:name'), firstName),
        ]);

        await SolidClientMock.createDocument(containerUrl, secondUrl, [
            RDFResourceProperty.type(secondUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(secondUrl, IRI('foaf:name'), secondName),
        ]);

        const documents = await engine.readMany(containerUrl, {
            $in: [brokenUrl, firstUrl, secondUrl],
            ...modelFilters(['foaf:Person']),
        });

        expect(Object.keys(documents)).toHaveLength(2);
        expect(documents[firstUrl]).toEqualJsonLD(stubPersonJsonLD(firstUrl, firstName));
        expect(documents[secondUrl]).toEqualJsonLD(stubPersonJsonLD(secondUrl, secondName));

        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(firstUrl);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(secondUrl);
    });

    it('gets many documents using globbing for $in filter', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const documentsCount = 10;
        const urls: string[] = [];
        const names: string[] = [];

        await Promise.all(Arr.range(documentsCount).map(async i => {
            const url = Url.resolve(containerUrl, `document-${i}`);
            const name = Faker.name.firstName();

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

        Arr.zip(urls, names).map(([url, name]) => {
            expect(documents[url]).toEqualJsonLD(stubPersonJsonLD(url, name));
        });

        expect(SolidClientMock.getDocuments).toHaveBeenCalledWith(containerUrl, false);
    });

    it('gets many documents using cache', async () => {
        // Arrange
        const containerUrl = Url.resolveDirectory(Faker.internet.url());
        const documentsCount = 5;
        const cachedDocumentsCount = 5;
        const urls: string[] = [];
        const names: string[] = [];

        (engine as any).config.globbingBatchSize = null;
        (engine as any).config.useCache = true;

        await Promise.all(Arr.range(documentsCount).map(async i => {
            const url = Url.resolve(containerUrl, `document-${i}`);
            const name = Faker.name.firstName();

            urls.push(url);
            names.push(name);

            await SolidClientMock.createDocument(containerUrl, url, [
                RDFResourceProperty.type(url, IRI('foaf:Person')),
                RDFResourceProperty.literal(url, IRI('foaf:name'), name),
            ]);
        }));

        await Promise.all(Arr.range(cachedDocumentsCount).map(async i => {
            const url = Url.resolve(containerUrl, `cached-document-${i}`);
            const name = Faker.name.firstName();

            urls.push(url);
            names.push(name);

            await SolidClientMock.createDocument(containerUrl, url, [
                RDFResourceProperty.type(url, IRI('foaf:Person')),
                RDFResourceProperty.literal(url, IRI('foaf:name'), name),
            ]);

            await engine.readOne(containerUrl, url);
        }));

        (SolidClientMock.getDocument as any).mockClear();

        // Act
        const documents = await engine.readMany(containerUrl, {
            $in: urls,
            ...modelFilters(['foaf:Person']),
        });

        // Assert
        expect(Object.keys(documents)).toHaveLength(urls.length);

        Arr.zip(urls, names).map(([url, name]) => {
            expect(documents[url]).toEqualJsonLD(stubPersonJsonLD(url, name));
        });

        urls.slice(0, documentsCount).map(url => expect(SolidClientMock.getDocument).toHaveBeenCalledWith(url));
        urls.slice(documentsCount).map(url => expect(SolidClientMock.getDocument).not.toHaveBeenCalledWith(url));
    });

    it('gets documents from cache using containers modified info', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url())
        const containerUrl = Url.resolveDirectory(parentUrl, Faker.random.uuid());
        const modifiedDocumentUrl = Url.resolve(containerUrl, 'modified');
        const modifiedDocumentName = Faker.name.firstName();
        const sameDocumentUrl = Url.resolve(containerUrl, 'same');
        const sameDocumentName = Faker.name.firstName();
        const now = new Date();
        const later = new Date(Date.now() + 1000);

        (engine as any).config.globbingBatchSize = null;
        (engine as any).config.useCache = true;

        // Arrange - create initial documents and populate cache
        await SolidClientMock.createDocument(parentUrl, containerUrl, [
            RDFResourceProperty.type(containerUrl, IRI('ldp:Container')),
            RDFResourceProperty.reference(containerUrl, IRI('ldp:contains'), modifiedDocumentUrl),
            RDFResourceProperty.literal(modifiedDocumentUrl, IRI('purl:modified'), now),
            RDFResourceProperty.reference(containerUrl, IRI('ldp:contains'), sameDocumentUrl),
            RDFResourceProperty.literal(sameDocumentUrl, IRI('purl:modified'), now),
        ]);

        await SolidClientMock.createDocument(containerUrl, modifiedDocumentUrl, [
            RDFResourceProperty.type(modifiedDocumentUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(modifiedDocumentUrl, IRI('foaf:name'), Faker.lorem.word()),
        ]);

        await SolidClientMock.createDocument(containerUrl, sameDocumentUrl, [
            RDFResourceProperty.type(sameDocumentUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(sameDocumentUrl, IRI('foaf:name'), sameDocumentName),
        ]);

        await engine.readOne(parentUrl, containerUrl);
        await engine.readMany(
            containerUrl,
            {
                $in: [modifiedDocumentUrl, sameDocumentUrl],
                ...modelFilters(['foaf:Person']),
            },
        );

        // Arrange - update documents
        await SolidClientMock.deleteDocument(containerUrl);
        await SolidClientMock.deleteDocument(modifiedDocumentUrl);

        await SolidClientMock.createDocument(parentUrl, containerUrl, [
            RDFResourceProperty.type(containerUrl, IRI('ldp:Container')),
            RDFResourceProperty.reference(containerUrl, IRI('ldp:contains'), modifiedDocumentUrl),
            RDFResourceProperty.literal(modifiedDocumentUrl, IRI('purl:modified'), later),
            RDFResourceProperty.reference(containerUrl, IRI('ldp:contains'), sameDocumentUrl),
            RDFResourceProperty.literal(sameDocumentUrl, IRI('purl:modified'), now),
        ]);

        await SolidClientMock.createDocument(containerUrl, modifiedDocumentUrl, [
            RDFResourceProperty.type(modifiedDocumentUrl, IRI('foaf:Person')),
            RDFResourceProperty.literal(modifiedDocumentUrl, IRI('foaf:name'), modifiedDocumentName),
        ]);

        await engine.readOne(parentUrl, containerUrl);

        (SolidClientMock.getDocument as any).mockClear();

        // Act
        const documents = await engine.readMany(
            containerUrl,
            {
                $in: [modifiedDocumentUrl, sameDocumentUrl],
                ...modelFilters(['foaf:Person']),
            },
        );

        // Assert
        expect(Object.keys(documents)).toHaveLength(2);

        await expect(documents[modifiedDocumentUrl]).toEqualJsonLD({
            '@graph': [{
                '@id': modifiedDocumentUrl,
                '@type': IRI('foaf:Person'),
                [IRI('foaf:name')]: modifiedDocumentName,
            }],
        });

        await expect(documents[sameDocumentUrl]).toEqualJsonLD({
            '@graph': [{
                '@id': sameDocumentUrl,
                '@type': IRI('foaf:Person'),
                [IRI('foaf:name')]: sameDocumentName,
            }],
        });

        expect(SolidClientMock.getDocument).toHaveBeenCalledTimes(1);
        expect(SolidClientMock.getDocument).toHaveBeenCalledWith(modifiedDocumentUrl);
    });

    it('updates document updated attributes', async () => {
        // Arrange
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());
        const name = Faker.random.word();

        await SolidClientMock.createDocument(parentUrl, documentUrl);

        // Act
        await engine.update(
            parentUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: [{
                        $where: {
                            '@id': documentUrl,
                        },
                        $update: {
                            [IRI('foaf:name')]: name,
                        },
                    }],
                },
            },
        );

        // Assert
        expect(SolidClientMock.updateDocument).toHaveBeenCalledWith(
            documentUrl,
            [
                RDFResourceProperty.literal(documentUrl, IRI('foaf:name'), name),
            ],
            [],
        );
    });

    it('updates document removed attributes', async () => {
        const parentUrl = Url.resolveDirectory(Faker.internet.url(), Str.slug(Faker.random.word()));
        const documentUrl = Url.resolve(parentUrl, Faker.random.uuid());

        await SolidClientMock.createDocument(parentUrl, documentUrl);

        await engine.update(
            parentUrl,
            documentUrl,
            {
                '@graph': {
                    $updateItems: [{
                        $where: {
                            '@id': documentUrl,
                        },
                        $update: {
                            [IRI('foaf:name')]: { $unset: true },
                        },
                    }],
                },
            },
        );

        expect(SolidClientMock.updateDocument).toHaveBeenCalledWith(
            documentUrl,
            [],
            [[documentUrl, IRI('foaf:name')]],
        );
    });

    it("fails updating when document doesn't exist", async () => {
        const documentUrl = Url.resolve(Faker.internet.url(), Faker.random.uuid());

        await expect(engine.readOne(Url.parentDirectory(documentUrl), documentUrl))
            .rejects
            .toBeInstanceOf(DocumentNotFound);
    });

    it('fails when attributes are not a JSON-LD graph', async () => {
        await expect(engine.create('', {}, '')).rejects.toBeInstanceOf(SoukaiError);
        await expect(engine.update('', '', {})).rejects.toBeInstanceOf(SoukaiError);
    });

});

function modelFilters(types: string[], extraFilters: object = {}): EngineFilters {
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
                                    { $eq: types[0] },
                                    { $eq: expandedTypes[0] },
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
