import { FieldDefinition, FieldType } from 'soukai';

import SolidModel, { SolidFieldDefinition } from '@/models/SolidModel';

interface RDFContextDefinition {
    name: string;
    propertyPrefix: string;
    iriPrefix: string;
    used: boolean;
}

class EmptyJsonLDValue {}

export default class SerializesToJsonLD {

    public hasAttribute: (field: string) => boolean;
    public getAttribute: (field: string) => any;
    protected classDef: typeof SolidModel;

    public toJsonLD(): object {
        const json = { '@context': {}, '@type': null };
        const contextDefinitions = this.getRDFContextDefinitions();

        for (const field of Object.keys(this.classDef.fields)) {
            this.setJsonLDField(json, field, contextDefinitions);
        }

        this.setJsonLDTypes(json, contextDefinitions);
        this.setJsonLDContexts(json, contextDefinitions);

        return json;
    }

    private getRDFContextDefinitions(): RDFContextDefinition[] {
        const rdfContexts: RDFContextDefinition[] = Object
            .entries(this.classDef.rdfContexts)
            .map(([name, iriPrefix]) => ({
                name,
                iriPrefix,
                propertyPrefix: `${name}:`,
                used: false,
            }));

        rdfContexts[0].name = '@vocab';
        rdfContexts[0].propertyPrefix = '';
        rdfContexts[0].used = true;

        return rdfContexts;
    }

    private setJsonLDField(json: object, field: string, contextDefinitions: RDFContextDefinition[]): void {
        if (!this.hasAttribute(field))
            return;

        const fieldDefinition = this.classDef.fields[field] as SolidFieldDefinition;

        if (field === this.classDef.primaryKey) {
            this.setJsonLDProperty(json, '@id', field, fieldDefinition);
            return;
        }

        for (const contextDefinition of contextDefinitions) {
            if (!fieldDefinition.rdfProperty.startsWith(contextDefinition.iriPrefix))
                continue;

            const propertyName = fieldDefinition.rdfProperty.substr(contextDefinition.iriPrefix.length);
            const propertySet = this.setJsonLDProperty(
                json,
                `${contextDefinition.propertyPrefix}${propertyName}`,
                field,
                fieldDefinition,
            );

            contextDefinition.used = contextDefinition.used || propertySet;
            return;
        }

        this.setJsonLDProperty(json, fieldDefinition.rdfProperty, field, fieldDefinition);
    }

    private setJsonLDTypes(json: object, contextDefinitions: RDFContextDefinition[]): void {
        const types = [...this.classDef.rdfsClasses]
            .map(rdfsClass => this.getShortRdfsClass(rdfsClass, contextDefinitions));

        json['@type'] = types.length === 0 ? types[0] : types;
    }

    private setJsonLDContexts(json: object, contextDefinitions: RDFContextDefinition[]): void {
        json['@context'] = contextDefinitions
            .filter(rdfContext => rdfContext.used)
            .reduce((contexts, contextDefinition) => ({
                ...contexts,
                [contextDefinition.name]: contextDefinition.iriPrefix,
            }), {});
    }



    private getShortRdfsClass(rdfsClass: string, contextDefinitions: RDFContextDefinition[]): string {
        for (const contextDefinition of contextDefinitions) {
            if (!rdfsClass.startsWith(contextDefinition.iriPrefix))
                continue;

            contextDefinition.used = true;

            return contextDefinition.propertyPrefix + rdfsClass.substr(contextDefinition.iriPrefix.length);
        }

        return rdfsClass;
    }

    private setJsonLDProperty(
        json: object,
        name: string,
        fieldName: any,
        fieldDefinition: SolidFieldDefinition,
    ): boolean {
        const value = this.castJsonLDValue(this.getAttribute(fieldName), fieldDefinition);

        if (value instanceof EmptyJsonLDValue)
            return false;

        json[name] = value;

        return true;
    }

    private castJsonLDValue(value: any, fieldDefinition?: FieldDefinition): any {
        switch (fieldDefinition && fieldDefinition.type || null) {
            case FieldType.Key:
                return value.toString();
            case FieldType.Date:
                return {
                    '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    '@value': (new Date(value)).toISOString(),
                };
            case FieldType.Array:
                switch (value.length) {
                    case 0:
                        return new EmptyJsonLDValue();
                    case 1:
                        return this.castJsonLDValue(value[0], fieldDefinition!.items!);
                    default:
                        return value.map(itemValue => this.castJsonLDValue(itemValue, fieldDefinition!.items!));
                }
                break;
            // TODO handle nested objects
            default:
                return JSON.parse(JSON.stringify(value));
        }
    }

}
