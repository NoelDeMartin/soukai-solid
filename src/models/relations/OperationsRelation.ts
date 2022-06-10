import { arrayFilter, arrayFrom, urlRoute } from '@noeldemartin/utils';
import type { Attributes, EngineDocument } from 'soukai';

import RDF from '@/solid/utils/RDF';
import { operationClass } from '@/models/history/operations';
import type AddPropertyOperation from '@/models/history/AddPropertyOperation';
import type Operation from '@/models/history/Operation';
import type RemovePropertyOperation from '@/models/history/RemovePropertyOperation';
import type SetPropertyOperation from '@/models/history/SetPropertyOperation';
import type UnsetPropertyOperation from '@/models/history/UnsetPropertyOperation';
import type { JsonLD, JsonLDGraph } from '@noeldemartin/solid-utils';
import type { Operations } from '@/models/history/operations';
import type { SolidBootedFieldsDefinition } from '@/models/fields';
import type { SolidModel } from '@/models/SolidModel';

import SolidHasManyRelation from './SolidHasManyRelation';

export default class OperationsRelation<Parent extends SolidModel = SolidModel>
    extends SolidHasManyRelation<Parent, Operation, typeof Operation> {

    constructor(parent: Parent) {
        super(parent, operationClass('Operation'), 'resourceUrl');
    }

    public attach(modelOrAttributes: Operation | Attributes): Operation;
    public attach<T extends keyof Operations>(attributes: Attributes, type: T): InstanceType<Operations[T]>;
    public attach(modelOrAttributes: Operation | Attributes, type?: keyof Operations): Operation {
        const Operation = operationClass('Operation');
        const model = modelOrAttributes instanceof Operation
            ? modelOrAttributes
            : operationClass(type ?? 'SetPropertyOperation').newInstance(modelOrAttributes);

        if (model.constructor === Operation) {
            throw new Error(
                'Creating base operations is meaningless, you should create a specific operation instead ' +
                '(add property, remove property, etc.)',
            );
        }

        return super.attach(model);
    }

    public attachAddOperation(attributes: Attributes): AddPropertyOperation {
        return this.attach(attributes, 'AddPropertyOperation');
    }

    public attachRemoveOperation(attributes: Attributes): RemovePropertyOperation {
        return this.attach(attributes, 'RemovePropertyOperation');
    }

    public attachSetOperation(attributes: Attributes): SetPropertyOperation {
        return this.attach(attributes, 'SetPropertyOperation');
    }

    public attachUnsetOperation(attributes: Attributes): UnsetPropertyOperation {
        return this.attach(attributes, 'UnsetPropertyOperation');
    }

    public async __loadDocumentModels(documentUrl: string, document: JsonLDGraph): Promise<void> {
        const foreignFields = this.relatedClass.fields as unknown as SolidBootedFieldsDefinition;
        const foreignProperty = foreignFields[this.foreignKeyName]?.rdfProperty as string;
        const reducedDocument = {
            '@graph': document['@graph'].filter(resource => resource['@id'] !== this.parent.id),
        } as EngineDocument & JsonLDGraph;
        const resources = document['@graph'].filter(resource => {
            const property = RDF.getJsonLDProperty(resource, foreignProperty);

            return typeof property === 'object'
                && property !== null
                && '@id' in property
                && (property as { '@id': string })['@id'] === this.parent.url;
        });
        const modelsInSameDocument = arrayFilter(
            await Promise.all(
                resources
                    .map(
                        async resource =>
                            this.getOperationClass(resource)?.createFromEngineDocument(
                                documentUrl,
                                reducedDocument,
                                resource['@id'],
                            ),
                    ),
            ),
        );
        const modelsInOtherDocumentIds = resources
            .map(resource => resource['@id'])
            .filter(
                resourceId =>
                    !modelsInSameDocument.some(model => model.url === resourceId) &&
                    urlRoute(resourceId) !== documentUrl,
            );

        this.protected.loadDocumentModels(modelsInSameDocument, modelsInOtherDocumentIds);
    }

    protected async loadRelatedModels(): Promise<Operation[]> {
        throw new Error('loading operations from different documents has not been implemented yet');
    }

    protected getOperationClass(resource: JsonLD): typeof Operation | undefined {
        // TODO This could be inferred from classes instead
        const rdfsClasses: Partial<Record<keyof Operations, string[]>> = {
            AddPropertyOperation: [
                'https://soukai.noeldemartin.com/vocab/AddPropertyOperation',
                'soukai:AddPropertyOperation',
            ],
            RemovePropertyOperation: [
                'https://soukai.noeldemartin.com/vocab/RemovePropertyOperation',
                'soukai:RemovePropertyOperation',
            ],
            SetPropertyOperation: [
                'https://soukai.noeldemartin.com/vocab/SetPropertyOperation',
                'soukai:SetPropertyOperation',
            ],
            UnsetPropertyOperation: [
                'https://soukai.noeldemartin.com/vocab/UnsetPropertyOperation',
                'soukai:UnsetPropertyOperation',
            ],
        };
        const resourceClasses = arrayFrom(resource['@type'] ?? []);
        const matchingEntry = Object
            .entries(rdfsClasses)
            .find(
                ([_, operationClasses]) => operationClasses?.some(
                    operationClass => resourceClasses.includes(operationClass),
                ),
            );

        return matchingEntry && operationClass(matchingEntry[0] as keyof Operations);
    }

}
