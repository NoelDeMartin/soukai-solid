import $rdf from 'rdflib';
import SolidAuthClient from 'solid-auth-client';

import Resource, { ResourceProperty } from '@/solid/Resource';

const LDP = $rdf.Namespace('http://www.w3.org/ns/ldp#');
const RDFS = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

class Solid {

    public async createResource(
        url: string,
        properties: ResourceProperty[] = [],
    ): Promise<Resource> {
        if (await this.resourceExists(url)) {
            throw new Error(`Cannot create a resource at ${url}, url already in use`);
        }

        const turtleData = properties
            .map(property => property.toTurtle(url) + ' .')
            .join("\n");

        await SolidAuthClient.fetch(url, {
            method: 'PUT',
            body: turtleData,
            headers: {
                'Content-Type': 'text/turtle',
            },
        });

        return new Resource(url, turtleData);
    }

    public async createContainer(
        url: string,
        properties: ResourceProperty[] = [],
    ): Promise<Resource> {
        if (await this.resourceExists(url)) {
            throw new Error(`Cannot create a resource at ${url}, url already in use`);
        }

        const turtleData = properties
            .map(property => property.toTurtle(url) + ' .')
            .join("\n");

        await SolidAuthClient.fetch(
            url, {
                method: 'POST',
                body: turtleData,
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
                },
            },
        );

        return new Resource(url, turtleData);
    }

    public async getResource(url: string): Promise<Resource | null> {
        const response = await SolidAuthClient.fetch(url);

        if (response.status !== 200) {
            return null;
        }

        return new Resource(url, await response.text());
    }

    public async getResources(containerUrl: string, types: string[] = []): Promise<Resource[]> {
        if (!containerUrl.endsWith('/')) {
            containerUrl += '/';
        }

        try {
            const data = await SolidAuthClient.fetch(containerUrl + '*').then(res => res.text());
            const store = $rdf.graph();

            $rdf.parse(data, store, containerUrl, 'text/turtle', null as any);

            const resourceNodes = store.each(
                null as any,
                RDFS('type'),
                LDP('Resource'),
                null as any
            );

            return resourceNodes
                .map(node => new Resource(node.value, store))
                .filter(resource => {
                    for (const type of types) {
                        if (resource.types.indexOf(type) === -1) {
                            return false;
                        }
                    }

                    return true;
                });
        } catch (e) {
            // Due to an existing bug, empty containers return 404
            // see: https://github.com/solid/node-solid-server/issues/900
            console.error(e);

            return [];
        }
    }

    public async updateResource(
        url: string,
        updatedProperties: ResourceProperty[],
        removedProperties: string[],
    ): Promise<void> {
        const inserts = updatedProperties
            .map(property => property.toTurtle(url) + ' .')
            .join('\n');

        const deletes = removedProperties
            .map(property => `<${url}> <${property}> ?any .`)
            .join('\n');

        const response = await SolidAuthClient.fetch(
            url,
            {
                method: 'PATCH',
                body: `
                    @prefix solid: <http://www.w3.org/ns/solid/terms#> .
                    <>
                        solid:patches <${url}> ;
                        solid:inserts { ${inserts} } ;
                        solid:deletes { ${deletes} } .
                `,
                headers: {
                    'Content-Type': 'text/n3',
                },
            },
        );

        if (response.status !== 200) {
            throw new Error(
                `Error updating resource at ${url}, returned status code ${response.status}`,
            );
        }
    }

    public async resourceExists(url: string): Promise<boolean> {
        const response = await SolidAuthClient.fetch(url);

        if (response.status === 200) {
            return true;
        } else if (response.status === 404) {
            return false;
        } else {
            throw new Error(
                `Couldn't determine if resource at ${url} exists, got ${response.status} response`
            );
        }
    }

}

export default new Solid();
