# Exactify.js

CLI tool that removes ^ prefix from package.json dependencies and replaces them with specific versions from your lockfile.

Supports `package-lock.json` (npm) and `bun.lock` (bun).

## Usage

```
npx exactify
```

or with bun:

```
bunx exactify
```

## Motivation

TL;DR: having inexact versions of dependencies in `package.json` is unsafe because it exposes your package to security and compatibility risks.

See more: [Is your package.json safe?](https://dev.to/mishgun/is-your-packagejson-safe-20c1)

## Example
```shell
$ npx exactify

Exactify will pin all ^ versions in package.json to exact versions from package-lock.json

Example: "react": "^17.0.3" -> "react": "17.0.15"

? Do you want to procceed? Yes
? Do you also want to add save-exact=true in your .npmrc? (recommended) Yes

Packages with updated minor versions:
axios: ^0.19.0 -> 0.19.2
classnames: ^2.2.6 -> 2.3.2
moment: ^2.24.0 -> 2.29.4
react-router-dom: ^5.1.2 -> 5.3.4
typescript: ^4.3.4 -> 4.8.4
...

Removed 111 carets from package versions
77 minor versions were updated with actual versions from package-lock.json
```
