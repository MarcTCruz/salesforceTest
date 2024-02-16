const fs = require('fs');
const path = require('path');
const process = require('process');

function setup({ org_alias, org_path }) {
    const newConfig = { org_alias: org_alias, org_path };
    const existingConfig = userConfigs.hasOwnProperty(org_alias) ? userConfigs[org_alias] : {};

    if (JSON.stringify(newConfig) === JSON.stringify(existingConfig)) {
        console.log('No changes to userConfigs, skipping write operation.');
        return;
    }

    userConfigs[org_alias] = { org_alias: org_alias, org_path };
    // Open this file (self)
    const filePath = path.join(__dirname, 'oopTest.js');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            process.exit(err.errno);
        }
        // Update the last row, replacing userConfigs with this updated userConfigs
        const updatedData = data.replace(/var userConfigs = \{\};/, `var userConfigs = ${JSON.stringify(userConfigs, null, 2)};`);
        fs.writeFile(filePath, updatedData, 'utf8', (err) => {
            if (err) {
                console.error('Error writing file:', err);
                process.exit(err.errno);
            }
        });
    });
}

function load(org_alias) {
    const user = userConfigs[org_alias];
    if (!user) {
        console.error(`User configuration for org alias '${org_alias}' does not exist.`);
        process.exit(1); // Exit with a failure status code
    }
    console.log(user);
    return user;
}

module.exports = {
    setup: setup,
    load: load
};

var userConfigs = {
    "myOrg": {
        "org_alias": "myOrg",
        "org_path": "/path/to/my/org"
    }
};