const { assert } = require('console');
const fs = require('fs');
const process = require('process');

function register(configObject, filePath) {
    const snapshot = JSON.stringify(configObject);
    // Store the configObject when the script ends
    process.on('exit', () => {
        if (JSON.stringify(configObject) === snapshot) {
            //console.log('No changes to userConfigs, skipping write operation.');
            return;
        }
        console.log(`Writing to file: ${filePath}`); // Log the file path
        try {
            // Write the updated configObject to a JSON file
            fs.writeFileSync(filePath, JSON.stringify(configObject, null, 2), 'utf8');
            //console.log('File updated successfully.'); // Log a success message
        } catch (err) {
            console.error('Error writing to file:', err);
            process.exit(err.errno);
        }
    });
}

function load(filePath) {
    const filePath = basicFilePath();
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const configObject = JSON.parse(data);
        register(configObject, filePath);
    } catch (err) {
        const newObject = {};
        register(newObject);
        return newObject;
    }
}

module.exports = {
    load: load,
    example: example
};

function example() {
    const userConfigs = {};

    register(userConfigs, __filename + ".json");
    userConfigs["example"] = { whatever: [] };
}