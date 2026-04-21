#! /usr/bin/env node
import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
import inquirer from 'inquirer';
import fs from 'fs';
const log = console.log;
const example = `${chalk.dim('Example:')} ${chalk.bold('"react": "^17.0.3" -> "react": "17.0.15"')}`;
function detectLockfile() {
    if (fs.existsSync('package-lock.json'))
        return 'npm';
    if (fs.existsSync('bun.lock'))
        return 'bun';
    return null;
}
function getVersionsFromNpmLockfile(lockContent, depsWithCarets) {
    const lockJson = JSON.parse(lockContent);
    return Object.fromEntries(Object.entries(lockJson.packages)
        .map(([packagePath, { version }]) => {
        return [packagePath.replace('node_modules/', ''), version];
    })
        .filter(([packagePath]) => depsWithCarets[packagePath]));
}
function parseJsonc(content) {
    // bun.lock uses JSONC format with trailing commas
    const stripped = content.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(stripped);
}
function getVersionsFromBunLockfile(lockContent, depsWithCarets) {
    const lockJson = parseJsonc(lockContent);
    return Object.fromEntries(Object.entries(lockJson.packages)
        .filter(([packageName]) => depsWithCarets[packageName])
        .map(([packageName, tuple]) => {
        const identifier = tuple[0];
        // identifier format: "name@version" - extract version after last @
        const atIndex = identifier.lastIndexOf('@');
        const version = atIndex > 0 ? identifier.slice(atIndex + 1) : undefined;
        return [packageName, version];
    })
        .filter(([, version]) => version !== undefined));
}
function getLockfileVersions(lockfileType, depsWithCarets) {
    const filename = lockfileType === 'npm' ? 'package-lock.json' : 'bun.lock';
    const content = fs.readFileSync(filename).toString();
    if (lockfileType === 'npm') {
        return getVersionsFromNpmLockfile(content, depsWithCarets);
    }
    return getVersionsFromBunLockfile(content, depsWithCarets);
}
const lockfileNames = {
    npm: 'package-lock.json',
    bun: 'bun.lock',
};
clear();
log(chalk.bold(figlet.textSync('exactify', {
    horizontalLayout: 'full',
    font: 'Georgia11',
})));
if (!fs.existsSync('package.json')) {
    log('Exactify pins all ^ versions in package.json to exact versions from your lockfile.');
    log(example);
    log(chalk.red('You should run exactify in a directory with package.json'));
    process.exit(0);
}
const lockfileType = detectLockfile();
if (!lockfileType) {
    log('No lockfile found in this directory. Run npm install or bun install first');
    process.exit(0);
}
log(`Exactify will pin all ^ versions in package.json to exact versions from ${lockfileNames[lockfileType]}`);
log();
log();
log(example);
log();
const prompts = [
    {
        type: 'confirm',
        name: 'isConfirmed',
        message: 'Do you want to procceed?',
    },
];
const isSaveExactSet = lockfileType === 'npm'
    ? fs.existsSync('.npmrc') &&
        fs.readFileSync('.npmrc').toString().includes('save-exact=true')
    : fs.existsSync('bunfig.toml') &&
        fs.readFileSync('bunfig.toml').toString().includes('exact = true');
if (!isSaveExactSet) {
    const saveExactMessage = lockfileType === 'npm'
        ? `Do you also want to add save-exact=true in your .npmrc? ${chalk.dim('(recommended)')}`
        : `Do you also want to add exact = true in your bunfig.toml? ${chalk.dim('(recommended)')}`;
    prompts.push({
        type: 'confirm',
        name: 'isSaveExactSetConfirmed',
        message: saveExactMessage,
        when: (answers) => answers.isConfirmed,
    });
}
inquirer
    .prompt(prompts)
    .then(({ isConfirmed, isSaveExactSetConfirmed }) => {
    var _a, _b;
    if (isConfirmed) {
        const packageJsonContent = fs.readFileSync('package.json').toString();
        const packageJson = JSON.parse(packageJsonContent);
        const depsWithCarets = Object.fromEntries(Object.entries(Object.assign(Object.assign({}, ((_a = packageJson === null || packageJson === void 0 ? void 0 : packageJson.dependencies) !== null && _a !== void 0 ? _a : {})), ((_b = packageJson === null || packageJson === void 0 ? void 0 : packageJson.devDependencies) !== null && _b !== void 0 ? _b : {}))).filter(([, version]) => version.startsWith('^')));
        const versionsFromLockfile = getLockfileVersions(lockfileType, depsWithCarets);
        const packagesToUpdate = Object.entries(depsWithCarets).map(([packageName, inexactVersion]) => {
            var _a;
            const realVersion = (_a = versionsFromLockfile[packageName]) !== null && _a !== void 0 ? _a : inexactVersion.replace('^', '');
            return [packageName, inexactVersion, realVersion];
        });
        const packagesWithUpdatedMinorVersion = packagesToUpdate
            .filter(([, inexactVersion, realVersion]) => {
            return inexactVersion.replace('^', '') !== realVersion;
        })
            .map(([packageName, inexactVersion, realVersion]) => {
            return `${packageName}: ${chalk.green(`${inexactVersion} -> ${realVersion}`)}`;
        });
        const updatedPackageJson = packagesToUpdate.reduce((result, [packageName, inexactVersion, realVersion]) => result.replace(`"${packageName}": "${inexactVersion}"`, `"${packageName}": "${realVersion}"`), packageJsonContent);
        fs.writeFileSync('package.json', updatedPackageJson);
        if (packagesWithUpdatedMinorVersion.length) {
            log();
            log('Packages with updated minor versions:');
            log(packagesWithUpdatedMinorVersion.join('\n'));
        }
        log();
        log(`Removed ${Object.keys(depsWithCarets).length} carets from package versions`);
        log(`${Object.keys(packagesWithUpdatedMinorVersion).length} minor versions were updated with actual versions from ${lockfileNames[lockfileType]}`);
        log();
        if (isSaveExactSetConfirmed) {
            if (lockfileType === 'npm') {
                if (fs.existsSync('.npmrc')) {
                    fs.appendFileSync('.npmrc', '\nsave-exact=true');
                }
                else {
                    fs.writeFileSync('.npmrc', 'save-exact=true\n');
                }
            }
            else {
                if (fs.existsSync('bunfig.toml')) {
                    const content = fs.readFileSync('bunfig.toml').toString();
                    if (content.includes('[install]')) {
                        fs.writeFileSync('bunfig.toml', content.replace('[install]', '[install]\nexact = true'));
                    }
                    else {
                        fs.appendFileSync('bunfig.toml', '\n[install]\nexact = true\n');
                    }
                }
                else {
                    fs.writeFileSync('bunfig.toml', '[install]\nexact = true\n');
                }
            }
        }
    }
})
    .catch((error) => {
    if (error.isTtyError) {
        console.error("Prompt couldn't be rendered in the current environment");
    }
    else {
        console.error(error);
    }
});
