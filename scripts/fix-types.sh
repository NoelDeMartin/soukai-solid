#!/usr/bin/env bash

sed -i 's/SolidModel_2/SolidModel/g' "dist/soukai-solid.d.ts"
sed -i 's/SolidModel_3/SolidModel/g' "dist/soukai-solid.d.ts"
sed -i '/^import { SolidModel as SolidModel } from/d' "dist/soukai-solid.d.ts"
