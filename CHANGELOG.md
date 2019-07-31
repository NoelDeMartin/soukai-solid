# Changelog

## v0.2.0

- Added new functionality related to Soukai 0.2.0 release (relationships, filters).
- Added `resourceUrls` implicit field to containers.
- Added `mintsUrls` static property on `SolidModel` to disable url minting of new models.
- Improved documentation.

### Breaking changes

- License changed from GPL to MIT ([read this](https://noeldemartin.com/tasks/improving-solid-focus-task-manager#comment-9) to learn why).
- Soukai dependency updated to version 0.2.0, check out [its changelog](https://github.com/NoelDeMartin/soukai-solid/tree/master/CHANGELOG.md#v020) to learn what changed.
- Some methods and its arguments have changed, be sure to check out the new [type definitions](https://github.com/NoelDeMartin/soukai-solid/tree/master/types).
- `SolidModel` attributes are now converted to JsonLD before being sent to engines, this is related with a refactor on Soukai 0.2.0 where models have been decoupled from engines.
- `solid-auth-client` dependency has been removed, the `SolidEngine` constructor now takes a function as an argument to interact with Solid PODs.

[Compare changes with previous version](https://github.com/NoelDeMartin/soukai/compare/v0.1.0...v0.2.0)

## v0.1.0

- First version.
