const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Declare an object to hold the required variables
const requiredVars = {
    ORG_ALIAS: '',
    ORG_PATH: ''
};

// Function to check if required variables are set and prompt for missing ones
function checkRequiredVariables()
{
    Object.keys(requiredVars).forEach(varName =>
    {
        if (!requiredVars[varName])
        {
            console.error(`The variable '${varName}' must be declared.`);
            console.log(`You can set it in your parent shell with the following command:`);
            console.log(`export ${varName}=<value>`);
            console.log("Or for many:S");
            console.log(`export var_name_0=<value> var_name_1=<value> ...`);
            return false;
        }
    });

    return true;
}

// Call the function to check the required variables
if (!checkRequiredVariables()) process.exit(1);

async function chdirSfdxProject()
{
    await execSync(`cd "${requiredVars.ORG_PATH}"`, { stdio: 'inherit' });
}

async function getWebSfdxUrlFileBase64Content()
{
    try
    {
        const response = await fetch(
            `https://api.salesforce.com/services/data/v51.0/sf/orgs/${requiredVars.ORG_ALIAS}/login`
        );

        if (!response.ok) throw new Error(response.statusText);

        const jsonBody = await response.json();

        return Buffer.from(jsonBody.loginUrl, 'base64').toString();
    } catch (error)
    {
        throw new Error(error.message);
    }
}

function isScriptRunningInHypervisor()
{
    // Hypervisor detection logic goes here.
    // For simplicity, we'll assume that running on a hypervisor is not supported.
    throw new Error("This script does not support running on a hypervisor.");
}

async function dependenciesSetup()
{
    await execSync('npm install @salesforce/cli --global', { stdio: 'inherit' });
    await execSync('npm install xmldom --global', { stdio: 'inherit' });

    fs.chmodSync('./jq', '755');
}

async function salesforceAuthenticate(sfdxUrlFileContent)
{
    const authOptions = JSON.parse(Buffer.from(sfdxUrlFileContent, 'base64'));

    await sf.auth({
        url: authOptions.sfdxUrl,
        clientId: process.env.SF_CLIENT_ID,
        clientSecret: process.env.SF_CLIENT_SECRET,
        username: process.env.SF_USERNAME,
        passwordTokenCredentialSourceId:
            `${authOptions.username}:${authOptions.password}`
    });

}
