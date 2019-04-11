import $rdf from 'rdflib';
import SolidAuthClient from 'solid-auth-client';

import Resource, { ResourceProperty } from '@/solid/Resource';

import Url from '@/utils/Url';

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
        if (!url.endsWith('/')) {
            throw new Error(`Container urls must end with a trailing slash, given ${url}`);
        }

        if (await this.resourceExists(url)) {
            throw new Error(`Cannot create a resource at ${url}, url already in use`);
        }

        const turtleData = properties
            .map(property => property.toTurtle(url) + ' .')
            .join("\n");

        await SolidAuthClient.fetch(
            Url.relativeBase(url.substr(0, url.length - 1)),
            {
                method: 'POST',
                body: turtleData,
                headers: {
                    'Slug': Url.filename(url.substr(0, url.length - 1)),
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
            // Globbing only returns non-container resources
            const resources = types.indexOf(LDP('Container').uri) === -1
                ? await this.getContainerResourcesUsingGlobbing(containerUrl)
                : await this.getContainerResources(containerUrl, true);

            return resources.filter(resource => {
                for (const type of types) {
                    if (!resource.is(type)) {
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
        const where = removedProperties
            .map((property, i) => `<${url}> <${property}> ?d${i} .`)
            .join('\n');

        const inserts = updatedProperties
            .map(property => property.toTurtle(url) + ' .')
            .join('\n');

        const deletes = removedProperties
            .map((property, i) => `<${url}> <${property}> ?d${i} .`)
            .join('\n');

        const operations = [
            `solid:patches <${url}>`,
            updatedProperties.length > 0 ? `solid:inserts { ${inserts} }` : null,
            removedProperties.length > 0 ? `solid:where { ${where} }` : null,
            removedProperties.length > 0 ? `solid:deletes { ${deletes} }` : null,
        ]
            .filter(part => part !== null)
            .join(';');

        const response = await SolidAuthClient.fetch(
            url,
            {
                method: 'PATCH',
                body: `
                    @prefix solid: <http://www.w3.org/ns/solid/terms#> .
                    <> ${operations} .
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

    private async getContainerResources(containerUrl: string, onlyContainers: boolean): Promise<Resource[]> {
        const store = $rdf.graph();
        const data = await SolidAuthClient.fetch(containerUrl).then(res => res.text());

        $rdf.parse(data, store, containerUrl, 'text/turtle', null as any);

        const resources = await Promise.all(
            store
                .statementsMatching($rdf.sym(containerUrl), LDP('contains'), null as any, null as any, false)
                .map(async statement => {
                    const resource = new Resource(statement.object.value, store);

                    // Requests only return ldp types for unexpanded resources, so we can only filter
                    // by containers or plain resources
                    if (onlyContainers && !resource.is(LDP('Container'))) {
                        return null;
                    }

                    return await this.getResource(resource.url);
                }),
        );

        return resources.filter(resource => resource !== null) as Resource[];
    }

    private async getContainerResourcesUsingGlobbing(containerUrl: string): Promise<Resource[]> {
        const store = $rdf.graph();
        const data = await SolidAuthClient.fetch(containerUrl + '*').then(res => res.text());

        $rdf.parse(data, store, containerUrl, 'text/turtle', null as any);

        return store
            .each(null as any, RDFS('type'), LDP('Resource'), null as any)
            .map(node => new Resource(node.value, store));
    }

}

export default new Solid();
