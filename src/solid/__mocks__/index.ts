import Resource, { ResourceProperty } from '@/solid/Resource';

export class SolidMock {

    private resources: { [url: string]: Resource } = {};

    public reset(): void {
        this.resources = {};
    }

    public async createResource(
        url: string,
        properties: ResourceProperty[] | Set<ResourceProperty> = [],
    ): Promise<Resource> {
        if (await this.resourceExists(url)) {
            throw new Error(`Cannot create a resource at ${url}, url already in use`);
        }

        if (!(properties instanceof Set)) {
            properties = new Set(properties);
        }

        properties.add(ResourceProperty.type('http://www.w3.org/ns/ldp#Resource'));

        const turtleData = [...properties]
            .map(property => property.toTurtle(url) + ' .')
            .join("\n");

        const resource = new Resource(url, turtleData);

        this.resources[url] = resource;

        return resource;
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

const instance = new SolidMock();

jest.spyOn(instance, 'createResource');
jest.spyOn(instance, 'getResource');
jest.spyOn(instance, 'getResources');
jest.spyOn(instance, 'updateResource');
jest.spyOn(instance, 'resourceExists');

export { Resource, ResourceProperty };

export default instance;
