const fs = require('fs');
const { DOMParser } = require('xmldom');

function replaceMembersWithAsterisksAll(filePath) {
  // Read the file synchronously
  const inputXml = fs.readFileSync(filePath, 'utf8');
  // Perform the substitution
  const outputXml = inputXml.replace(/(\s+)(<members>.*<\/members>\s+)+/gm, '$1<members>*</members>$1');

  // Write the result back to the file
  fs.writeFileSync('output.xml', outputXml);
  console.log('Conversion completed successfully.');
}

function namesGetAll(filePath) {
  const xmlData = fs.readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlData, 'application/xml');

  const nameElements = doc.getElementsByTagName('name');
  const names = [];
  for (let i = 0; i < nameElements.length; i++) {
    names.push(nameElements[i].textContent);
  }
  return names;
}

function salesforceRetrieveAll() {
  // Get all names and log them
  const names = namesGetAll(process.argv[2]);

  // Map over the names and create commands (if needed)
  const commands = names.map(metadataName => `sf project retrieve start --metadata ${metadataName}`);
  // Execute the commands or do something with them
  const bigParallelCommand = commands.join(" &\n") + " & \nwait";
  //console.log(bigParallelCommand);
  return bigParallelCommand;
}

salesforceRetrieveAll();

/**
 * branch structure:
 * root/pipeline_script.yml
 * root/Org/{salesforce project}
 * 
 * install dependencies
 * create stage0 branch if it does not exist.
 * create homologation branch if it does not exist.
 *  checkout new branch
 *  create salesoforce project
 *  generate salesforce manifest
 *  retrieve data using javascript + sf cli.
 *  git add .
 *  git commit 
 *  git pull
 * create production branch if it does not exist.
 *  checkout new branch
 *  create salesoforce project
 *  generate salesforce manifest
 *  retrieve data using javascript + sf cli.
 *  git add .
 *  git commit 
 *  git pull
 * 
 * main:stage0:
 *  on pull:
 *    make salesforce tests(sf tests ./manifest/card/{cardNumber}.xml):
 *      on succeed: 
 *        deploy to Salesforce HML(sf deploy ./manifest/card/cardNumber.xml)
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