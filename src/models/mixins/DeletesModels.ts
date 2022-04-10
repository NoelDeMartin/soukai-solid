import { urlParentDirectory, urlRoot } from '@noeldemartin/utils';

import type { SolidModel } from '@/models/SolidModel';

type ResourcesGraph = { '@graph': { '@id': string }[] };
type DocumentModels = { documentUrl: string; models: SolidModel[] };
type DecantedDocumentModels = Record<string, SolidModel[]>;
type DecantedContainerDocuments = Record<string, DocumentModels[]>;

export type This = SolidModel;

export default class DeletesModels {

    protected async deleteModels(this: This, models: SolidModel[]): Promise<void> {
        const containersDocuments = this.decantDocumentModelsByContainer(models);

        await Promise.all(
            Object
                .entries(containersDocuments)
                .map(
                    ([containerUrl, containerDocuments]) => this.deleteContainerDocumentsModels(
                        containerUrl,
                        containerDocuments,
                    ),
                ),
        );
    }

    private decantDocumentModelsByContainer(models: SolidModel[]): DecantedContainerDocuments {
        const documentModels = this.decantModelsByDocument(models);

        return Object.entries(documentModels).reduce((containerModels, [documentUrl, models]) => {
            const containerUrl = urlParentDirectory(documentUrl) ?? urlRoot(documentUrl);
            const urlModels = containerModels[containerUrl] = containerModels[containerUrl] ?? [];

            urlModels.push({ documentUrl, models });

            return containerModels;
        }, {} as DecantedContainerDocuments);
    }

    private decantModelsByDocument(models: SolidModel[]): DecantedDocumentModels {
        return models.reduce((documentModels, model) => {
            const documentUrl = model.requireDocumentUrl();
            const sameDocumentModels = documentModels[documentUrl] = documentModels[documentUrl] ?? [];

            sameDocumentModels.push(model);

            return documentModels;
        }, {} as DecantedDocumentModels);
    }

    private async deleteContainerDocumentsModels(
        this: This,
        containerUrl: string,
        documentsModels: DocumentModels[],
    ): Promise<void> {
        const engineDocuments = await this.requireEngine().readMany(
            containerUrl,
            { $in: documentsModels.map(({ documentUrl }) => documentUrl) },
        ) as Record<string, ResourcesGraph>;

        await Promise.all(
            documentsModels.map(
                ({ documentUrl, models }) => this.deleteDocumentModels(
                    engineDocuments,
                    containerUrl,
                    documentUrl,
                    models,
                ),
            ),
        );
    }

    private async deleteDocumentModels(
        this: This,
        engineDocuments: Record<string, ResourcesGraph>,
        containerUrl: string,
        documentUrl: string,
        models: SolidModel[],
    ): Promise<void> {
        const document = engineDocuments[documentUrl];

        if (!document)
            return;

        const modelUrls = models.filter(model => model.exists()).map(model => model.url);

        if (!document['@graph'].some(resource => !modelUrls.some(url => url === resource['@id']))) {
            await this.requireEngine().delete(containerUrl, documentUrl);

            models.forEach(model => model.setDocumentExists(false));

            return;
        }

        await this.requireEngine().update(containerUrl, documentUrl, {
            '@graph': {
                $updateItems: {
                    $where: { '@id': { $in: modelUrls } },
                    $unset: true,
                },
            },
        });
    }

}
