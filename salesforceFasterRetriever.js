const fs = require('fs');
const { DOMParser } = require('xmldom');
const { spawn } = require('child_process');
const readline = require('readline');

function namesGetAll(filePath) {
  try {
    const xmlData = fs.readFileSync(filePath, 'utf8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlData, 'application/xml');

    const nameElements = doc.getElementsByTagName('name');
    const names = [];
    for (let i = 0; i < nameElements.length; i++) {
      names.push(nameElements[i].textContent);
    }
    return names;
  } catch (error) {
    console.error('Error: An error occurred while processing the manifest XML file.');
    console.error(error);
    process.exit(error.code);
  }
}
function promptUserForConfirmation(message, optionNoCallback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const confirmed = answer[0].toLowerCase() === 'y';
      if (!confirmed && optionNoCallback) {
        optionNoCallback();
      }
      resolve(confirmed);
    });
  });
}

async function salesforceRetrieveAll() {

  // Check if argv is passed
  if (!process.argv[2]) {
    console.error('Error: You must call this script with the package.xml file path as an argument.')
    console.erro(`Usage: node ${process.argv[1]} package.xml`);
    process.exit(1);
  }

  await promptUserForConfirmation('It will replace all retrieved files, do you want to continue? (y/n): ', () => process.exit(0));

  const names = namesGetAll(process.argv[2]);
  const commands = names.map(metadataName => `sf project retrieve start --metadata ${metadataName}`);

  // Execute the commands in parallel
  const commandPromises = commands.map(command => {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { stdio: 'inherit' });

      child.on('error', (error) => {
        console.error(`Error executing command: ${command}`, error);
        reject(error);
      });

      child.on('exit', (code, signal) => {
        if (code !== 0) {
          console.error(`Command exited with code: ${code} and signal: ${signal}`);
          reject(new Error(`Command exited with code: ${code} and signal: ${signal}`));
        } else {
          resolve();
        }
      });
    });
  });

  // Wait for all commands to complete
  Promise.all(commandPromises)
    .then(() => {
      console.log('All commands have completed successfully.');
    })
    .catch((error) => {
      console.error('An error occurred while executing the commands:', error);
    });
}

salesforceRetrieveAll();