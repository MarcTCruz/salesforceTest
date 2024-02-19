const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chdir, cwd } = require('process');

const commandSafeExit = (fn, ...args) => {
    try {
        return fn(...args);
    } catch (error) {
        console.error(`Failed to execute command: ${fn.name} ${args.join("")}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        process.exit(error.status);
    }
};
const execSyncSafe = (...args) => commandSafeExit(execSync, ...args, { stdio: 'inherit' });
const chdirSafe = (...args) => commandSafeExit(chdir, ...args);
const cwdSafe = (...args) => commandSafeExit(cwd, ...args);




// Function to retrieve and commit changes from sandbox
function retrieveFromSalesforceAndCommitChanges(branchName, commitMessage) {
    execSyncSafe(`git switch ${branchName}`);
    execSyncSafe(`git fetch origin ${branchName}`);

    //execSyncSafe(`node manifestHandler.js ./manifest/package.xml`);

    execSyncSafe(`git add .`);
    execSyncSafe(`git push`);
    if (execSyncSafe(`git diff --staged --quiet`).error) {
        execSyncSafe(`git commit -m "${commitMessage}"`);
    }
}

// Function to sync branches
function gitBranchesSync(who, accordingTo) {
    execSyncSafe(`git checkout ${who}`);
    execSyncSafe(`git rebase ${accordingTo}`);
    execSyncSafe(`git push`);
}


function ifNotExistsCreateBranch(newBranchName, likeBranchName) {
    try {
        //exists locally
        execSync(`git show-ref --verify --quiet refs/heads/${newBranchName}`);
        return false;
    } catch (error) {
        if (execSyncSafe(`git ls-remote --heads origin ${newBranchName}`).length > 0)
        //exists remotelly
        {
            return false;
        }
    }

    execSyncSafe(`git branch ${newBranchName} ${likeBranchName}`);
    return true;
}


const { load, basicFilePath } = require('./jsonStorage.js');
function getSettingsByAlias(alias) {
    manySettings = load(__filename + ".json");

    if (typeof manySettings[alias] === "undefined") {
        manySettings[alias] = {};
    }

    return manySettings[alias];
}

class SalesforceCI {
    constructor(settingsAlias) {
        this.org = getSettingsByAlias(settingsAlias);
    }
    // Function to check if deployment tests pass
    deploymentTestsPass() {
        const validationJSON = execSyncSafe(`sf deploy metadata validate --manifest ./manifest/package.xml --target-org ${this.org.alias} --json`, { encoding: 'utf8' });
        const parsedValidation = JSON.parse(validationJSON);
        const jobId = parsedValidation.result.id;

        if (!jobId) {
            console.error('Unexpected result from validation initiation.');
            console.debug(parsedValidation);
            process.exit(1);
        }

        let parsedResult;
        do {
            execSyncSafe('sleep  5');
            const JSONResult = execSyncSafe(`sf deploy metadata report --jobid ${jobId} --target-org ${this.org.alias} --json`);
            parsedResult = JSON.parse(JSONResult).result;
            console.log(`Validation Status: ${parsedResult.status}`);
        } while (parsedResult.done === false);

        if (parsedResult.status !== 'Succeeded') {
            console.error('Validation failed. Errors:');
            console.error(parsedResult.details.componentFailures);
            gitBranchesSync('stage1', 'stage0');
            process.exit(1);
        }
    }

    deployMetadata() {
        execSyncSafe(`sf deploy metadata -r force-app -x ./manifest/package.xml --target-org ${this.org.alias}`);
    }

    chdirBack() {
        chdirSafe(this.backPath);
    }
    chdirProject() {
        this.backPath = cwdSafe();
        chdirSafe(this.org.path);
    }

    projectRetrieve() {
        const { retrieve } = require('./salesforceFasterRetriever.js');
        retrieve();
    }

    manifestGenerate() {
        execSyncSafe(`sf project generate manifest --output-dir ./manifest --from-org ${this.org.alias}`);
    }

    authenticate(urlFileAsBase64) {
        const authFileName = crypto.randomUUID() + ".json";
        const authFile = path.join(cwdSafe(), authFileName);
        fs.writeFileSync(authFile, btoa(urlFileAsBase64));
        execSyncSafe(`sf org login sfdx-url --sfdx-url-file ${authFile} --set-default --alias ${this.org.alias}`);
        fs.unlinkSync(authFile);
    }

    getUrlFileAsBase64() {
        try {
            execSync(`sf org display --target-org ${this.org.alias}`);
        } catch (error) {
            execSyncSafe(`sf org login web --alias ${this.org.alias}`);
            execSyncSafe(`sf config set target-org ${this.org.alias}`);
        }

        const result = execSyncSafe(`sf org display --target-org ${this.org.alias} --verbose --json`);
        return atob(result);
    }

    projectGenerate(dir = "") {

        if (dir.length) {
            this.org.path = path.join(cwdSafe(), dir);
        }

        const currentDir = cwdSafe();
        this.chdirProject();
        execSyncSafe(`sf project generate --name org --template empty`);
        this.chdirBack();
    }
}

// Example usage
// salesforceAuthenticate(getWebSfdxUrlFileBase64Content());
// retrieveFromSalesforceAndCommitChanges('my-branch', 'My commit message');
// ifNotExistsCreateBranch('another-branch');
// deploymentTestsPass();
// deployMetadata();

/**
 * checkout self
 * branch structure:
 * root/pipeline_script.yml
 * root/org/{salesforce project}
 *
 * install dependencies
 * create stage0 branch based on model branch if it does not exist.
 * create Homologation branch based on model branch if it does not exist.
 *  checkout most recent branch
 *  generate salesforce project
 *  authorize salesforce project
 *  generate salesforce manifest from-org
 *  retrieve data using javascript + sf cli.
 *  git add .
 *  git commit
 *  git pull
 *
 * ---------------------------------------------
 * create production branch if it does not exist.
 *  checkout most recent branch
 *  generate salesforce project
 *  authorize salesforce project
 *  generate salesforce manifest from-org
 *  retrieve data using javascript + sf cli.
 *  git add .
 *  git commit
 *  git pull
 * ---------------------------------------------
 *
 * main:stage0:
 *  on pull(If pipeline is already running, fail or wait):
 *    make salesforce tests(sf tests ./manifest/{cardNumber}/deploy.xml, ./manifest/{cardNumber}/destructiveChangesPre.xml, ./manifest/{cardNumber}/destructiveChangesPost.xml):
 *      on success:
 *        deploy to Salesforce HML(sf deploy ./manifest/{cardNumber}/[A-z]{1,}\.xml)
 *        make main like stage0
 *        git switch to Homologation branch
 *        sf retrieve changes from salesforce(sf retrieve ./manifest/card/cardNumber.xml or retrieve all using javascript?)
 *        git commit changes to branch
 *        git pull
 *      on fail:
 *        make stage0 like main
 *
 * card:deploy:
 *  on pull:
 *    store cardNumber
 */

