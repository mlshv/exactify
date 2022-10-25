#! /usr/bin/env node
import chalk from 'chalk'
import clear from 'clear'
import figlet from 'figlet'
import inquirer from 'inquirer'
import fs from 'fs'

const log = console.log

const example = `${chalk.dim('Example:')} ${chalk.bold(
  '"react": "^17.0.3" -> "react": "17.0.15"',
)}`

clear()
log(
  chalk.bold(
    figlet.textSync('exactify', {
      horizontalLayout: 'full',
      font: 'Georgia11',
    }),
  ),
)

if (!fs.existsSync('package.json')) {
  log(
    'exactify is a CLI tool that replaces all inexact package.json versions with specific versions from package-lock.json',
  )
  log(example)
  log(chalk.red('You should run exactify in a directory with package.json'))
  process.exit(0)
}

if (!fs.existsSync('package-lock.json')) {
  log('There is no package-lock.json in this directory. Run npm install first')
  process.exit(0)
}

log(
  '🙌 You are going to replace all inexact package.json versions with specific versions from package-lock.json',
)
log()
log()
log(example)
log()

const prompts: any[] = [
  {
    type: 'confirm',
    name: 'isConfirmed',
    message: 'Do you want to procceed?',
  },
]

const isSaveExactSet =
  fs.existsSync('.npmrc') &&
  fs.readFileSync('.npmrc').toString().includes('save-exact=true')

if (!isSaveExactSet) {
  prompts.push({
    type: 'confirm',
    name: 'isSaveExactSetConfirmed',
    message: `Do you also want to add save-exact=true in your .npmrc? ${chalk.dim(
      '(recommended)',
    )}`,
    when: (answers) => answers.isConfirmed,
  })
}

inquirer
  .prompt(prompts)
  .then(({ isConfirmed, isSaveExactSetConfirmed }) => {
    if (isConfirmed) {
      const packageJsonContent = fs.readFileSync('package.json').toString()
      const packageLockJsonContent = fs
        .readFileSync('package-lock.json')
        .toString()

      const packageJson = JSON.parse(packageJsonContent) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const pacakgeLockJson = JSON.parse(packageLockJsonContent) as {
        packages: Record<string, { version: string }>
      }

      const depsWithCarets = Object.fromEntries(
        Object.entries({
          ...(packageJson?.dependencies ?? {}),
          ...(packageJson?.devDependencies ?? {}),
        }).filter(([, version]) => version.startsWith('^')),
      )

      const vesrionsFromPackageLock = Object.fromEntries(
        Object.entries(pacakgeLockJson.packages)
          .map(([packagePath, { version }]) => {
            return [packagePath.replace('node_modules/', ''), version]
          })
          .filter(([packagePath]) => depsWithCarets[packagePath]),
      )

      const packagesToUpdate = Object.entries(depsWithCarets).map(
        ([packageName, inexactVersion]) => {
          const realVersion =
            vesrionsFromPackageLock[packageName] ??
            inexactVersion.replace('^', '')
          return [packageName, inexactVersion, realVersion]
        },
      )

      const packagesWithUpdatedMinorVersion = packagesToUpdate
        .filter(([, inexactVersion, realVersion]) => {
          return inexactVersion.replace('^', '') !== realVersion
        })
        .map(([packageName, inexactVersion, realVersion]) => {
          return `${packageName}: ${chalk.green(
            `${inexactVersion} -> ${realVersion}`,
          )}`
        })

      const updatedPackageJson = packagesToUpdate.reduce(
        (result, [packageName, inexactVersion, realVersion]) =>
          result.replace(
            `"${packageName}": "${inexactVersion}"`,
            `"${packageName}": "${realVersion}"`,
          ),
        packageJsonContent,
      )

      fs.writeFileSync('package.json', updatedPackageJson)

      if (packagesWithUpdatedMinorVersion.length) {
        log()
        log('Packages with updated minor versions:')
        log(packagesWithUpdatedMinorVersion.join('\n'))
      }

      log()
      log(
        `Removed ${
          Object.keys(depsWithCarets).length
        } carets from package versions`,
      )
      log(
        `${
          Object.keys(packagesWithUpdatedMinorVersion).length
        } minor versions were updated with actual versions from package-lock.json`,
      )
      log()

      if (isSaveExactSetConfirmed) {
        if (fs.existsSync('.npmrc')) {
          fs.appendFileSync('.npmrc', '\nsave-exact=true')
        } else {
          fs.writeFileSync('.npmrc', 'save-exact=true\n')
        }
      }
    }
  })
  .catch((error) => {
    if (error.isTtyError) {
      console.error("Prompt couldn't be rendered in the current environment")
    } else {
      console.error(error)
    }
  })
