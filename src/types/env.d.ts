export {};

import '@noeldemartin/solid-utils/src/types/vitest';

declare global {
    interface Window {
        // Available in Aerogel apps.
        $app?: { environment?: string };
    }
}
