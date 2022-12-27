#!/usr/bin/env bash

# I'm not sure why this is necessary, but the generated types are not valid (typeof is dropped from SolidModel).
# This happens during @microsoft/api-extractor's rollup phase, but I haven't been able to find out why.
# See https://api-extractor.com/pages/overview/demo_rollup/
sed -i "s/}> & Constructor<SolidModel> & SolidModel;/}> \& Constructor<SolidModel> \& typeof SolidModel;/" dist/soukai-solid.d.ts
sed -i "s/}> & Constructor<Operation> & SolidModel;/}> \& Constructor<Operation> \& typeof SolidModel;/" dist/soukai-solid.d.ts
sed -i "s/}> & Constructor<PropertyOperation> & SolidModel;/}> \& Constructor<PropertyOperation> \& typeof SolidModel;/" dist/soukai-solid.d.ts
