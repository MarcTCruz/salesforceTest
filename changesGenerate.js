const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const execSyncSafe = (command) => {
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Failed to execute command: ${command}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        process.exit(error.status);
    }
};

// Add all changes to the staging area
execSyncSafe("git add .");
/**
 * Without git add ., untracked files will show as ??
 * renamed files will show as delete and ??
 * new files from untracked folder will not show...
 */

const gitChangesOutput = execSync('git status --porcelain=1').toString().trim();
const rows = gitChangesOutput ? gitChangesOutput.split("\n") : [];

const deletedSources = [];
const modifiedSources = [];
const pushSourceDir = (value) => modifiedSources.push(value);
const pushDeletingSource = (value) => deletedSources.push(value);
const splitAndPush = (values) => {
    const [firstHalf, secondHalf] = values.split(/\s+->\s+/);
    pushDeletingSource(firstHalf);
    pushSourceDir(secondHalf);
};
const gitConditionsHandlers = {
    C: pushSourceDir,
    A: pushSourceDir,
    U: pushSourceDir,
    M: pushSourceDir, // Assuming M should behave the same as A
    D: pushDeletingSource,
    R: splitAndPush
};

for (const row of rows) {
    if (row.startsWith("org/force-app/main/default") || row.startsWith("force-app/main/default")) {
        const [reportingOption, filePath] = row.replace("org/", "").split(/\s+/);
        gitConditionsHandlers[reportingOption](filePath);
    }
}

// Construct the Salesforce CLI command
const sfModificationPackageCommand = `sf project source convert --output-dir ./constructiveDeploy --source-dir ${modifiedSources.join(' ')}`;
const sfDeletiionPackageCommand = `sf project source convert --output-dir ./destructiveChanges --source-dir ${deletedSources.join(' ')}`;

// Change the working directory to the root of your Salesforce project
const orgDirectory = path.resolve(__dirname, './org');
if (fs.existsSync(orgDirectory)) {
    console.error(`Moving to ${orgDirectory}.`);
    process.chdir(orgDirectory);
}

// Execute the Salesforce CLI commands to create package.xml under deploy dir
modifiedSources.length && execSyncSafe(sfModificationPackageCommand);
deletedSources.length && execSyncSafe(sfDeletiionPackageCommand);

/**
 * You can’t use destructiveChanges.xml
 * to delete items that are associated with an active
 * Lightning page, such as a custom object,
 * a component on the page, or the page itself.
 * First, you must remove the page's action override
 * by deactivating it in the Lightning App Builder.
 * https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas_destructive_changes.htm
 */