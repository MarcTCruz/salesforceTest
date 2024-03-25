chmod +x ./functionsForPipeline.sh

export ORG_ALIAS="Sandbox" ORG_PATH="./org"
./functionsForPipeline.sh
# Main execution
Stage0branchName='stage0'
MainbranchName='main'
homologationBranchName='Homologation'
productionBranchName='Production'


dependencies_setup

Homologation_sfdxUrlFileBase64Content=$(Homologation_sfdxUrlFileBase64Content)
salesforce_authenticate "$Homologation_sfdxUrlFileBase64Content"
if_not_exists_create_branch "$homologationBranchName"
retrieve_from_salesforce_and_commit_changes "$homologationBranchName" "Initial population."

Production_sfdxUrlFileBase64Content=$(Production_sfdxUrlFileBase64Content)
salesforce_authenticate "$Production_sfdxUrlFileBase64Content"
if_not_exists_create_branch "$productionBranchName"
retrieve_from_salesforce_and_commit_changes "$productionBranchName" "Initial population."


if deployment_tests_pass; then
    sync_branches "$Stage0branchName" "$branchMain"
else
    sync_branches "$branchMain" "$Stage0branchName"
fi
deploy_metadata

retrieve_from_salesforce_and_commit_changes "$homologationBranchName" "Initial population."