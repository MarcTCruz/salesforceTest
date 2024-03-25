const fs = require('fs');
const execSync = require('child_process');
const path = require('path');
const assert = require('assert');

const definitions =
{
    LOCAL_REPOSITORY_ROOT: undefined,
    SALESFORCE_PATH: undefined
};
const deletedSfPaths = []; // Change this to set, as rename is also shown as delete when file is moved.
const deletedFullGitPaths = []; // Cchange this to set same reason
const modifiedSfSources = []; // I think it does not need to be a set, need to copy a file to another folder without deleting the origin to test
/**
 * Executes a shell command synchronously and safely, handling errors gracefully.
 * @param {string} command - The shell command to execute.
 */
const execSyncSafe = (command) => {
    try {
        return execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Failed to execute command: ${command}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        process.exit(error.status);
    }
};

/**
 * Handles the pushing of source directories based on git conditions.
 * @param {string} sfFilePath - The value representing the source directory.
 */
const pushSourceDir = (sfFilePath) => modifiedSfSources.push(sfFilePath);
/**
 * Handles the pushing of deleting sources based on git conditions.
 * @param {string} sfFilePath - The value representing the source to be deleted.
 * @param {string} fullGitPath - The full path of the source to be deleted.
 */
const pushDeletedSource = (sfFilePath, fullGitPath) => {
    deletedSfPaths.push(sfFilePath);
    deletedFullGitPaths.push(fullGitPath);
};

/**
 * Splits a string and pushes the resulting values to the appropriate handlers.
 * @param {string} valuesStr - The string containing the values to be split and pushed.
 */
const splitAndPush = (valuesStr) => {
    const [to, from] = valuesStr.split(/\0/);
    pushDeletedSource(from);
    pushSourceDir(to);
};

const gitConditionsHandlers =
{
    C: pushSourceDir,
    A: pushSourceDir,
    U: pushSourceDir,
    M: pushSourceDir,
    D: pushDeletedSource,
    R: splitAndPush
};


/**
 * Processes a string against a regular expression and invokes a callback function with the matches.
 * The callback function handles the matched strings based on git condition patterns.
 * @param {string} str - The string to match against the regular expression.
 * @param {RegExp} regex - An object containing the regex pattern and callback function.
 * @param {Function} callback - The callback function to invoke with the matches.
 */
function onMatchCall(str, regex, callback) {
    var result = false;
    var matches;
    const regex = regex;
    while ((matches = regex.exec(str)) !== null) {
        if (matches.index === regex.lastIndex)
        // This is good to avoid infinite loops with zero-width matches
        {
            regex.lastIndex++;
        }
        callback(matches, str);
        result = true;
    }

    return result;
}

/**
 * Processes the sources and logs the results of the conversion to XML format.
 * @param {Array<string>} sources - The array of source directories to process.
 * @param {string} outputDir - The directory where the converted XML files will be saved.
 */
const makeManifest = (sources, outputDir) => {
    if (sources.length === 0) return;

    const salesforceBaseDirectory = path.resolve(__dirname, definitions.SALESFORCE_PATH);
    process.chdir(salesforceBaseDirectory);

    const sfPackageCommand = `sf project source convert --output-dir ${outputDir} --source-dir ${sources.join(' ')}`;
    execSyncSafe(sfPackageCommand);
};

const isSFDXProject = (somePath) => {
    const sfdxConfigPath = path.join(somePath, 'sfdx-project.json');
    if (fs.existsSync(sfdxConfigPath)) {
        return true;
    }

    return false;
};

/**
 * Restores deleted files from Git in a single command.
 * @param {Array<string>} filePaths - An array of file paths to restore.
 */
function restoreDeletedFilesUsingGit(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return false;
    }

    process.chdir(definitions.LOCAL_REPOSITORY_ROOT);
    const filePathArgs = filePaths.map(filePath => `"${filePath}"`).join(' ');
    execSyncSafe(`git checkout HEAD -- ${filePathArgs}`);
    return true;
}

/**
 * Deletes a list of files specified by their file paths.
 * @param {Array<string>} filePaths - An array of file paths to delete.
 */
function deleteFiles(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        console.debug('No file paths provided to delete.');
        return;
    }

    process.chdir(definitions.LOCAL_REPOSITORY_ROOT);
    filePaths.forEach((filePath) => {
        try {
            fs.unlinkSync(filePath);
        } catch (error) {
            console.error(`Failed to delete file: ${filePath}`);
            console.error(`Error message: ${error.message}`);
            process.exit(error.status);
        }
    });
}

const matchingSetup =
{
    option: undefined,
    discoveredSalesforcePath: undefined,
    wrongPaths: new Set(),
    regex: /(.*?)(force-app\/main\/default\/.*)/gm,
    callback: (matches, fullPath) => {
        if (matchingSetup.wrongPaths.has(matches[1])) {
            return;
        }

        if (matches.length < 2)
        // It is a directory
        {
            return;
        }

        const sfFilePath = matches[matches.length - 1];
        const isSfDXPath = matchingSetup.discoveredSalesforcePath === sfFilePath ||
            isSFDXProject(matches[1]);
        if (isSfDXPath === false) {
            matchingSetup.wrongPaths.add(matches[1]);
            return;
        }

        matchingSetup.discoveredSalesforcePath = `./${matches[1]}`
        gitConditionsHandlers[matchingSetup.option](sfFilePath, fullPath);
    }
};

//--------------------------- Actual process ---------------------------
/**
 * Without git add ., untracked files will show as ??
 * renamed files will show as delete and ??
 * new files from untracked folder will not show...
 */
definitions.LOCAL_REPOSITORY_ROOT = execSyncSafe('git rev-parse --show-toplevel').toString().trim("\n");
process.chdir(definitions.LOCAL_REPOSITORY_ROOT);
execSyncSafe("git add .");
const gitChangesOutput = execSyncSafe('git status --porcelain=1 -z')
    .toString();// Removes last null from output

assert(gitChangesOutput.length !== 0, `"git status --porcelain=1 -z" shows No file changes!"`);
gitChangesOutput
    // Removes last null
    .replace(/\0$/, '')
    // Formats output to replace postceded null(\0 {char} ) for newline, for easier handling of mine
    .replace(/\0([A-Z])\s+/gm, `\n$1 `)
    .split("\n")
    .forEach(row => {
        const [option, filePath] = row.split(/(?<=^[A-Z])\s+/);//split the space between first characther and remaining path
        matchingSetup.option = option;
        onMatchCall(filePath, matchingSetup.regex, matchingSetup.callback);
    });

assert(matchingSetup.discoveredSalesforcePath !== undefined, "Undiscovered Salesforce Path.");
definitions.SALESFORCE_PATH = matchingSetup.discoveredSalesforcePath;

makeManifest(modifiedSfSources, 'constructiveDeploy');

restoreDeletedFilesUsingGit(deletedFullGitPaths);
makeManifest(deletedSfPaths, 'destructiveChanges');
deleteFiles(deletedFullGitPaths);
