import Url from '@/utils/Url';

import type { SolidModel } from '@/models/SolidModel';

type ResourcesGraph = { '@graph': { '@id': string }[] };
type DocumentModels = { documentUrl: string; models: SolidModel[] };
type DecantedDocumentModels = Record<string, SolidModel[]>;
type DecantedContainerDocuments = Record<string, DocumentModels[]>;

export default class DeletesModels {

    protected async deleteModels(this: SolidModel, models: SolidModel[]): Promise<void> {
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
            const containerUrl = Url.parentDirectory(documentUrl);

            if (!(containerUrl in containerModels))
                containerModels[containerUrl] = [];

            containerModels[containerUrl].push({ documentUrl, models });

            return containerModels;
        }, {} as DecantedContainerDocuments);
    }

    private decantModelsByDocument(models: SolidModel[]): DecantedDocumentModels {
        return models.reduce((documentModels, model) => {
            const documentUrl = model.requireDocumentUrl();

            if (!(documentUrl in documentModels))
                documentModels[documentUrl] = [];

            documentModels[documentUrl].push(model);

            return documentModels;
        }, {} as DecantedDocumentModels);
    }

    private async deleteContainerDocumentsModels(
        this: SolidModel,
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
        this: SolidModel,
        engineDocuments: Record<string, ResourcesGraph>,
        containerUrl: string,
        documentUrl: string,
        models: SolidModel[],
    ): Promise<void> {
        const modelUrls = models.filter(model => model.exists()).map(model => model.url);
        const { '@graph': resources } = engineDocuments[documentUrl];

        if (!resources.some(resource => !modelUrls.some(url => url === resource['@id']))) {
            await this.requireEngine().delete(containerUrl, documentUrl);

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
