const { execSync } = require('child_process');
const path = require('path');

execSync("git add -A"); 
/**
 * Without git add -A, untracked files will show as ??
 * renamed files will show as delete and ??
 * new files from untracked folder will not show...
 */

// Run git diff --names-only and store the result in rows[]
const gitDiffOutput = execSync('git status --porcelain=1 -z').toString().trim();
const rows = gitDiffOutput ? gitDiffOutput.split("\0") : [];

const sourceDirs = [];
for (const row of rows) {
    // If the row starts with "org/force-app/main/default"
    if (row.startsWith("org/force-app/main/default")) {
        // Remove "org/" and store the result in sourceDirs
        sourceDirs.push(row.replace("org/", ""));
    }
}

// Construct the Salesforce CLI command
const sfProjectSourceConvertCommand = `sf project source convert --output-dir ./deploy --source-dir ${sourceDirs.join(' ')}`;

process.chdir(path.resolve(__dirname, './org'));
// Execute the Salesforce CLI command
execSync(sfProjectSourceConvertCommand, { stdio: 'inherit' });