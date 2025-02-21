import { FieldType, bootModels, setEngine } from 'soukai';
import { fakeDocumentUrl } from '@noeldemartin/testing';
import { SolidEngine } from '@/engines/SolidEngine';
import { FakeResponse, FakeServer } from '@noeldemartin/utils';

import { defineSolidModelSchema } from '@/models/schema';

import SchemaTaskSchema from '@/testing/lib/stubs/SchemaTask.schema';
import ICalTaskSchema, { ICAL_TASK_FIELDS } from '@/testing/lib/stubs/ICalTask.schema';

class Task extends SchemaTaskSchema {}

describe('Solid Schema Migrations', () => {

    let server: FakeServer;

    beforeEach(() => {
        server = new FakeServer();

        setEngine(new SolidEngine(server.fetch));
        bootModels({ Task });
    });

    it('migrates schemas', async () => {
        // Arrange
        const documentUrl = fakeDocumentUrl();

        server.respondOnce(documentUrl, FakeResponse.notFound());
        server.respondOnce(documentUrl, FakeResponse.success());

        const task = await Task.create({
            url: `${documentUrl}#it`,
            name: 'Migrate schemas',
        });

        server.respondOnce(documentUrl, FakeResponse.success(await task.toTurtle()));
        server.respondOnce(documentUrl, FakeResponse.success());

        // Act
        await task.migrateSchema(ICalTaskSchema);

        // Assert
        expect(server.getRequests()).toHaveLength(4);

        expect(server.getRequests()[3]?.body).toEqualSparql(`
            DELETE DATA {
                @prefix schema: <https://schema.org/>.

                <#it>
                    a schema:Action ;
                    schema:name "Migrate schemas" .
            } ;

            INSERT DATA {
                @prefix ical: <http://www.w3.org/2002/12/cal/ical#>.

                <#it>
                    a ical:Vtodo ;
                    ical:summary "Migrate schemas" .
            } .
        `);
    });

    it('migrates schemas with history', async () => {
        // Arrange
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
        // Arrange
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

        server.respondOnce(url, FakeResponse.success(await task.toTurtle({ history: true })));
        server.respondOnce(url, FakeResponse.success());

        // Act
        await task.migrateSchema(defineSolidModelSchema(ICalTaskSchema, {
            fields: {
                ...ICAL_TASK_FIELDS,
                description: {
                    type: FieldType.String,
                    alias: 'name',
                },
            },
            hooks: {
                beforeSave() {
                    this.setAttribute('priority', 1);
                },
            },
        }));

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
