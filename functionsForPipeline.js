const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
import { chdir, cwd } from 'node:process';

const commandSafeExit = (fn, ...args) =>
{
    try
    {
        return fn(...args);
    } catch (error)
    {
        console.error(`Failed to execute command: ${fn.name} ${args.join("")}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        process.exit(error.status);
    }
};
const execSyncSafe = (...args) => commandSafeExit(execSync, ...args, { stdio: 'inherit' });
const chdirSafe = (...args) => commandSafeExit(chdir, ...args);
const cwdSafe = (...args) => commandSafeExit(cwd, ...args);

// Function to change directory to the Salesforce DX project
function chdirSfdxProject()
{
    chdirSafe(settings.org_path);
}

// Function to retrieve and commit changes from sandbox
function retrieveFromSalesforceAndCommitChanges(branchName, commitMessage)
{
    execSyncSafe(`git switch ${branchName}`);
    execSyncSafe(`git fetch origin ${branchName}`);

    // manifestHandler.js is a Node.js script that retrieves metadata
    execSyncSafe(`node manifestHandler.js ./manifest/package.xml`);

    execSyncSafe(`git add .`);
    execSyncSafe(`git push`);
    if (execSyncSafe(`git diff --staged --quiet`).error)
    {
        execSyncSafe(`git commit -m "${commitMessage}"`);
    }
}

// Function to sync branches
function gitBranchesSync(who, accordingTo)
{
    execSyncSafe(`git checkout ${who}`);
    execSyncSafe(`git rebase ${accordingTo}`);
    execSyncSafe(`git push`);
}

// Function to get the base64 content of the sfdxUrlFile
function salesforceUrlFileAsBase64()
{
    try
    {
        execSync(`sf org display --target-org ${settings.org_alias}`);
    } catch (error)
    {
        execSyncSafe(`sf org login web --alias ${settings.org_alias}`);
        execSyncSafe(`sf config set target-org ${settings.org_alias}`);
    }

    const result = execSyncSafe(`sf org display --target-org ${settings.org_alias} --verbose --json`);
    return atob(result);
}

// Function to authenticate with Salesforce
function salesforceAuthenticate(urlFileAsBase64)
{
    const authFileName = crypto.randomUUID() + ".json";
    const authFile = path.join(cwdSafe(), authFileName);
    fs.writeFileSync(authFile, btoa(urlFileAsBase64));
    execSyncSafe(`sf org login sfdx-url --sfdx-url-file ${authFile} --set-default --alias ${settings.org_alias}`);
    fs.unlinkSync(authFile);
}


function salesforceProjectGenerate(dir = "")
{
    if (dir.length)
    {
        settings.org_path = path.join(cwdSafe(), dir);
    }
    const currentDir = cwdSafe();
    chdirSfdxProject();
    execSyncSafe(`sf project generate --name org --template empty`);
    chdirSafe(currentDir); // Go back to the original directory
}

function salesforceProjectPopulate()
{
    execSyncSafe(`sf project generate manifest --output-dir ./manifest --from-org ${settings.org_alias}`);
}
function ifNotExistsCreateBranch(newBranchName, likeBranchName)
{
    try
    {
        //exists locally
        execSync(`git show-ref --verify --quiet refs/heads/${newBranchName}`);
        return false;
    } catch (error)
    {
        if (execSyncSafe(`git ls-remote --heads origin ${newBranchName}`).length > 0)
        //exists remotelly
        {
            return false;
        }
    }

    execSyncSafe(`git branch ${newBranchName}`);
    return true;
}


// Function to check if deployment tests pass
function deploymentTestsPass()
{
    const validationJSON = execSyncSafe(`sf deploy metadata validate --manifest ./manifest/package.xml --target-org ${settings.org_alias} --json`, { encoding: 'utf8' });
    const parsedValidation = JSON.parse(validationJSON);
    const jobId = parsedValidation.result.id;

    if (!jobId)
    {
        console.error('Unexpected result from validation initiation.');
        console.debug(parsedValidation);
        process.exit(1);
    }

    let parsedResult;
    do
    {
        execSyncSafe('sleep  5');
        const JSONResult = execSyncSafe(`sf deploy metadata report --jobid ${jobId} --target-org ${settings.org_alias} --json`);
        parsedResult = JSON.parse(JSONResult).result;
        console.log(`Validation Status: ${parsedResult.status}`);
    } while (parsedResult.done === false);

    if (parsedResult.status !== 'Succeeded')
    {
        console.error('Validation failed. Errors:');
        console.error(parsedResult.details.componentFailures);
        gitBranchesSync('stage1', 'stage0');
        process.exit(1);
    }
}

// Function to deploy metadata
function deployMetadata()
{
    execSyncSafe(`sf deploy metadata -r force-app -x ./manifest/package.xml --target-org ${settings.org_alias}`);
}

// Example usage
// salesforceAuthenticate(getWebSfdxUrlFileBase64Content());
// retrieveFromSalesforceAndCommitChanges('my-branch', 'My commit message');
// ifNotExistsCreateBranch('another-branch');
// deploymentTestsPass();
// deployMetadata();

// Declare an object to hold the required variables
var settings = { org_alias: '', org_path: '' };