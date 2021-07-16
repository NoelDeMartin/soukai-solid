import type { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import type RDFResourceProperty from '@/solid/RDFResourceProperty';

import { OperationType } from './Operation';
import type Operation from './Operation';

export default class UpdatePropertyOperation implements Operation {

    public type: OperationType.UpdateProperty = OperationType.UpdateProperty;

    constructor(public propertyOrProperties: RDFResourceProperty | RDFResourceProperty[]) {
        if (!Array.isArray(propertyOrProperties))
            return;

        if (propertyOrProperties.length === 0)
            throw new Error('Cannot create an UpdatePropertyOperation with an empty array');

        const { resourceUrl, name, type } = propertyOrProperties[0];
        if (
            propertyOrProperties.slice(1).some(
                p => p.resourceUrl !== resourceUrl || p.name !== name || p.type !== type,
            )
        )
            throw new Error(
                'All properties in an UpdatePropertyOperation must have the same resourceUrl, name and type',
            );
    }

    public get propertyResourceUrl(): string | null {
        return Array.isArray(this.propertyOrProperties)
            ? this.propertyOrProperties[0].resourceUrl
            : this.propertyOrProperties.resourceUrl;
    }

    public get propertyName(): string {
        return Array.isArray(this.propertyOrProperties)
            ? this.propertyOrProperties[0].name
            : this.propertyOrProperties.name;
    }

    public get propertyType(): RDFResourcePropertyType {
        return Array.isArray(this.propertyOrProperties)
            ? this.propertyOrProperties[0].type
            : this.propertyOrProperties.type;
    }

}
