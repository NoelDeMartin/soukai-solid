import Resource, { ResourceProperty } from '@/solid/Resource';

import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

export class SolidClientMock {

    private resources: { [url: string]: Resource } = {};

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

        if (url === null) {
            url = Url.resolve(parentUrl, UUID.generate());
        }

        if (await this.resourceExists(url)) {
            throw new Error(`Cannot create a resource at ${url}, url already in use`);
        }

        const resource = new Resource(url, turtleData);

        this.resources[url] = resource;

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
        return url in this.resources ? this.resources[url] : null;
    }

    public async getResources(containerUrl: string, types: string[] = []): Promise<Resource[]> {
        const resources: Resource[] = [];

        for (const resource of Object.values(this.resources)) {
            if (resource.url.startsWith(containerUrl)) {
                resources.push(resource);
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
        return url in this.resources;
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
