const fs = require('fs');
const process = require('process');
let registered = false;

function register(configObject) {
    if (registered) {
        return;
    }
    registered = true;

    const snapshot = JSON.stringify(configObject);
    // Store the configObject when the script ends
    process.on('exit', () => {
        if (JSON.stringify(configObject) === snapshot) {
            //console.log('No changes to userConfigs, skipping write operation.');
            return;
        }
        const filePath = process.argv[1] || __filename;
        console.log(`Reading file from path: ${filePath}`); // Log the file path
        try {
            let data = fs.readFileSync(filePath, 'utf8');
            //console.log(`Original data: ${data}`); // Log the original data

            // Update the last row, replacing userConfigs with this updated userConfigs
            const updatedData = data.replace(/var userConfigs = \{\};/, `var userConfigs = ${JSON.stringify(configObject, null, 2)};`);
            //console.log(`Updated data: ${updatedData}`); // Log the updated data

            fs.writeFileSync(filePath, updatedData, 'utf8');
            //console.log('File updated successfully.'); // Log a success message
        } catch (err) {
            console.error('Error reading or writing file:', err);
            process.exit(err.errno);
        }
    });
}

function store(config) {
    register(userConfigs);
    userConfigs[config.org_alias] = { ...userConfigs[config.org_alias], ...config };
}

function load(org_alias) {
    if (typeof userConfigs[org_alias] === "undefined") {
        console.error(`User configuration for org alias '${org_alias}' does not exist.`);
        process.exit(1); // Exit with a failure status code
    }
    return userConfigs[org_alias];
}

module.exports = {
    load: load,
    store: store
};

var userConfigs = {
    "myOrg": {
        "org_alias": "myOrg",
        "org_path": "/path/to/my/org",
        "additionalProperty1": "value1",
        "additionalProperty2": "value2"
    }
};
