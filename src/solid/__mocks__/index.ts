import RDF from '@/solid/utils/RDF';
import Resource, { ResourceProperty } from '@/solid/Resource';

import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export class SolidClientMock {

    private resources: { [url: string]: Resource[] } = {};

    public reset(): void {
        this.resources = {};
    }

    public async createResource(
        parentUrl: string,
        url: string | null = null,
        properties: ResourceProperty[] = [],
    ): Promise<Resource> {
        const turtleData = properties
            .map(property => property.toTurtle(url || '') + ' .')
            .join("\n");

        if (url === null)
            url = Url.resolve(parentUrl, UUID.generate());

        if (await this.resourceExists(url))
            throw new Error(`Cannot create a resource at ${url}, url already in use`);

        const resource = await RDF.parseTurtle(url, turtleData);

        this.resources[url] = [resource];

        return resource;
    }

    public async createEmbeddedResource(
        parentUrl: string,
        url: string | null = null,
        properties: ResourceProperty[] = [],
    ) {
        const turtleData = properties
            .map(property => property.toTurtle(url || '') + ' .')
            .join("\n");

        if (url === null)
            url = `${parentUrl}#${UUID.generate()}`;

        if (!(await this.resourceExists(parentUrl)))
            throw new Error(`Cannot create an embedded resource at ${url}, parent doesn't exist`);

        const resource = await RDF.parseTurtle(url, turtleData);

        this.resources[parentUrl].push(resource);

        return resource;
    }

    public async createContainer(
        parentUrl: string,
        url: string | null = null,
        properties: ResourceProperty[] = [],
    ): Promise<Resource> {
        return this.createResource(parentUrl, url, properties);
    }

    public async getResource(url: string): Promise<Resource | null> {
        return url in this.resources ? this.resources[url][0] : null;
    }

    public async getResources(containerUrl: string, types: string[] = []): Promise<Resource[]> {
        const resources: Resource[] = [];

        for (const urlResources of Object.values(this.resources)) {
            for (const resource of urlResources) {
                if (resource.url.startsWith(containerUrl)) {
                    resources.push(resource);
                }
            }
        }

        return resources;
    }

    public async updateResource(
        url: string,
        updatedProperties: ResourceProperty[],
        removedProperties: string[],
    ): Promise<void> {
        if (url in this.resources) {
            // TODO
        } else {
            throw new Error(
                `Error updating resource at ${url}, returned status code 404`,
            );
        }
    }

    public async resourceExists(url: string): Promise<boolean> {
        return !!Object.keys(this.resources).find(resourceUrl => {
            if (!url.startsWith(resourceUrl))
                return false;

            for (const resource of this.resources[resourceUrl]) {
                if (resource.url === url)
                    return true;
            }

            return false;
        });
    }
}

const instance = new SolidClientMock();

jest.spyOn(instance, 'createResource');
jest.spyOn(instance, 'createContainer');
jest.spyOn(instance, 'getResource');
jest.spyOn(instance, 'getResources');
jest.spyOn(instance, 'updateResource');
jest.spyOn(instance, 'resourceExists');

export { Resource, ResourceProperty };

export default instance;
