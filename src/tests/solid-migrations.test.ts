import { FieldType, bootModels, setEngine } from 'soukai';
import { fakeDocumentUrl } from '@noeldemartin/testing';
import { SolidEngine } from '@/engines/SolidEngine';
import { FakeResponse, FakeServer } from '@noeldemartin/utils';

import { defineSolidModelSchema } from '@/models/schema';

describe('Solid Schema Migrations', () => {

    let server: FakeServer;

    beforeEach(() => {
        server = new FakeServer();

        setEngine(new SolidEngine(server.fetch));
    });

    it('migrates schemas', async () => {
        // Arrange - define models
        const SchemaTaskSchema = defineSolidModelSchema({
            history: true,
            rdfsClass: 'Action',
            rdfContexts: {
                default: 'https://schema.org/',
                ical: 'http://www.w3.org/2002/12/cal/ical#',
            },
            fields: {
                name: FieldType.String,
                status: FieldType.Key,
                completedAt: {
                    type: FieldType.Date,
                    rdfProperty: 'ical:completed',
                },
            },
        });
        const ICalTaskSchema = defineSolidModelSchema({
            history: true,
            rdfsClass: 'Vtodo',
            rdfContext: 'http://www.w3.org/2002/12/cal/ical#',
            fields: {
                name: {
                    type: FieldType.String,
                    rdfProperty: 'summary',
                },
                completedAt: {
                    type: FieldType.Date,
                    rdfProperty: 'completed',
                },
            },
        });

        class Task extends SchemaTaskSchema {}

        bootModels({ Task });

        // Arrange - Create instance
        const documentUrl = fakeDocumentUrl();

        server.respondOnce(documentUrl, FakeResponse.notFound());
        server.respondOnce(documentUrl, FakeResponse.success());
        server.respondOnce(documentUrl, FakeResponse.success());
        server.respondOnce(documentUrl, FakeResponse.success());

        const task = await Task.create({
            url: `${documentUrl}#it`,
            name: 'Initial name',
            status: 'https://schema.org/PotentialActionStatus',
            completedAt: new Date(),
        });

        await task.update({ name: 'Updated name' });

        // Arrange - Set up responses
        server.respondOnce(documentUrl, FakeResponse.success(await task.toTurtle({ history: true })));
        server.respondOnce(documentUrl, FakeResponse.success());

        // Act
        await task.migrateSchema(ICalTaskSchema);

        // Assert
        expect(server.getRequests()).toHaveLength(6);

        expect(server.getRequests()[5]?.body).toEqualSparql(`
            DELETE DATA {
                @prefix schema: <https://schema.org/>.
                @prefix crdt: <https://vocab.noeldemartin.com/crdt/>.
                @prefix xml: <http://www.w3.org/2001/XMLSchema#>.

                <#it>
                    a schema:Action ;
                    schema:name "Updated name" ;
                    schema:status schema:PotentialActionStatus .

                <[[operation-1][.*]]> crdt:property schema:name .

                <[[operation-2][.*]]>
                    a crdt:SetPropertyOperation ;
                    crdt:resource <#it> ;
                    crdt:date "[[.*]]"^^xml:dateTime ;
                    crdt:property schema:status ;
                    crdt:value schema:PotentialActionStatus .

                <[[operation-3][.*]]> crdt:property schema:name .
            } ;

            INSERT DATA {
                @prefix ical: <http://www.w3.org/2002/12/cal/ical#>.
                @prefix crdt: <https://vocab.noeldemartin.com/crdt/>.

                <#it>
                    a ical:Vtodo ;
                    ical:summary "Updated name" .

                <[[operation-1][.*]]> crdt:property ical:summary .
                <[[operation-3][.*]]> crdt:property ical:summary .
            } .
        `);
    });

    it('changes urls when migrating schemas', async () => {
        // Arrange - define models
        const SchemaTaskSchema = defineSolidModelSchema({
            history: true,
            defaultResourceHash: '',
            rdfsClass: 'Action',
            rdfContexts: {
                default: 'https://schema.org/',
                ical: 'http://www.w3.org/2002/12/cal/ical#',
            },
            fields: {
                name: FieldType.String,
                status: FieldType.Key,
                completedAt: {
                    type: FieldType.Date,
                    rdfProperty: 'ical:completed',
                },
            },
        });
        const ICalTaskSchema = defineSolidModelSchema({
            history: true,
            rdfsClass: 'Vtodo',
            rdfContext: 'http://www.w3.org/2002/12/cal/ical#',
            fields: {
                name: {
                    type: FieldType.String,
                    rdfProperty: 'summary',
                },
                description: {
                    type: FieldType.String,
                    alias: 'name',
                },
                completedAt: {
                    type: FieldType.Date,
                    rdfProperty: 'completed',
                },
                priority: FieldType.Number,
            },
            hooks: {
                beforeSave() {
                    this.setAttribute('priority', 1);
                },
            },
        });

        class Task extends SchemaTaskSchema {}

        bootModels({ Task });

        // Arrange - Create instance
        const url = fakeDocumentUrl();

        server.respondOnce(url, FakeResponse.notFound());
        server.respondOnce(url, FakeResponse.success());
        server.respondOnce(url, FakeResponse.success());
        server.respondOnce(url, FakeResponse.success());

        const task = await Task.create({
            url,
            name: 'Initial name',
            status: 'https://schema.org/PotentialActionStatus',
            completedAt: new Date(),
        });

        await task.update({ name: 'Updated name' });

        // Arrange - Set up responses
        server.respondOnce(url, FakeResponse.success(await task.toTurtle({ history: true })));
        server.respondOnce(url, FakeResponse.success());

        // Act
        await task.migrateSchema(ICalTaskSchema);

        // Assert
        expect(server.getRequests()).toHaveLength(6);

        expect(server.getRequests()[5]?.body).toEqualSparql(`
            DELETE DATA {
                @prefix schema: <https://schema.org/>.
                @prefix crdt: <https://vocab.noeldemartin.com/crdt/>.
                @prefix xml: <http://www.w3.org/2001/XMLSchema#>.
                @prefix ical: <http://www.w3.org/2002/12/cal/ical#>.

                <>
                    a schema:Action ;
                    schema:name "Updated name" ;
                    schema:status schema:PotentialActionStatus ;
                    ical:completed "[[completedAt][.*]]"^^xml:dateTime .

                <#metadata> crdt:resource <> .

                <[[operation-1][.*]]>
                    crdt:resource <> ;
                    crdt:property schema:name .

                <[[operation-2][.*]]>
                    crdt:resource <> .

                <[[operation-3][.*]]>
                    a crdt:SetPropertyOperation ;
                    crdt:resource <> ;
                    crdt:date "[[.*]]"^^xml:dateTime ;
                    crdt:property schema:status ;
                    crdt:value schema:PotentialActionStatus .

                <[[operation-4][.*]]>
                    crdt:resource <> ;
                    crdt:property schema:name .
            } ;

            INSERT DATA {
                @prefix ical: <http://www.w3.org/2002/12/cal/ical#>.
                @prefix crdt: <https://vocab.noeldemartin.com/crdt/>.
                @prefix xml: <http://www.w3.org/2001/XMLSchema#>.

                <#it>
                    a ical:Vtodo ;
                    ical:summary "Updated name" ;
                    ical:description "Updated name" ;
                    ical:priority 1 ;
                    ical:completed "[[completedAt][.*]]"^^xml:dateTime .

                <#metadata> crdt:resource <#it> .

                <[[operation-1][.*]]>
                    crdt:resource <#it> ;
                    crdt:property ical:summary .

                <[[operation-2][.*]]>
                    crdt:resource <#it> .

                <[[operation-3][.*]]>
                    crdt:resource <#it> ;
                    crdt:property ical:summary .

                <[[operation-4][.*]]>
                    a crdt:SetPropertyOperation ;
                    crdt:resource <#it> ;
                    crdt:date "[[.*]]"^^xml:dateTime ;
                    crdt:property ical:priority ;
                    crdt:value 1 .

                <[[operation-5][.*]]>
                    a crdt:SetPropertyOperation ;
                    crdt:resource <#it> ;
                    crdt:date "[[.*]]"^^xml:dateTime ;
                    crdt:property ical:description ;
                    crdt:value "Updated name" .
            } .
        `);
    });

});
