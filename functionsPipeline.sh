#!/bin/bash

is_script_running_in_hypervisor() {
    grep -Fwf /sys/hypervisor/uuid /proc/sys/kernel/osrelease &>/dev/null
    return $?
}

dependencies_setup() {
    set -e
    sudo npm install @salesforce/cli --global
    sudo npm install xmldom --global
    chmod 777 ~/jq
}

get_web_sfdxUrlFileBase64Content() {
    set -e
    if ! sf org display --target-org ORG &>/dev/null; then
        sf org login web --alias ORG &>/dev/null
        sf config set target-org ORG &>/dev/null
    fi

    sf org display --target-org ORG --verbose --json | base64 #local sh
}

salesforce_authenticate() {
    set -e
    local sfdxUrlFileContent=$1

    AUTH_FILE=$(mktemp --suffix=.json)
    echo "$sfdxUrlFileContent" | base64 --decode >"$AUTH_FILE"
    sf org login sfdx-url --sfdx-url-file "$AUTH_FILE" --set-default --alias ORG
    unlink "$AUTH_FILE"
}

# Function to retrieve and commit changes from sandbox
retrieve_from_salesforce_and_commit_changes() {
    set -e
    local branchName=$1
    local commitMessage=$2
    git switch "$branchName"
    git fetch origin "$branchName"
    eval " $(node ~/manifestHandler.js ./manifest/package.xml)" # retrieves all metadata parallelized to speed up process and reduce the chance of hitting 10k files limit.

    git add .
    git push
    git diff --staged --quiet || git commit -m "$commitMessage"
}

if_not_exits_create_homologation_branch() {
    set -e
    local branchName=$1
    # shellcheck disable=SC2155
    local existsBranch=$(git ls-remote --heads origin ${branchName})
    if [[ -z ${existsBranch} ]]; then
        return 0
    fi

    git switch -c "$branchName"
    git fetch origin "$branchName"
    sf project generate --name ORG --template standard
    sf project generate manifest --output-dir ./manifest --from-org ORG
    retrieve_from_salesforce_and_commit_changes "$branchName" "Commiting near everything"
}

sync_branches() {
    set -e
    who=$1
    accordingTo=$2
    
    git checkout "$who"
    git rebase "$accordingTo"
    git push
}

deployment_tests_pass() {
    set -e
    # shellcheck disable=SC2155
    local validationResult=$(sf deploy metadata validate --manifest ./manifest/package.xml --target-org ORG --json)
    # shellcheck disable=SC2155
    local jobId=$(echo "$validationResult" | ~/jq -r ".result.id")

    if [ -z "$jobId" ]; then
        echo "Unexpected result from validation initiation."
        return 1
    fi

    local isComplete="false"
    local status
    while [ "$isComplete" == "false" ]; do
        sleep 10
        # shellcheck disable=SC2155
        local statusResult=$(sf deploy metadata report --jobid "$jobId" --target-org ORG --json)
        isComplete=$(echo "$statusResult" | ./jq -r ".result.done")
        status=$(echo "$statusResult" | ./jq -r ".result.status")
        echo "Validation Status: $status"
    done

    if [ "$status" != "Succeeded" ]; then
        echo "Validation failed. Errors:"
        echo "$statusResult" | ./jq -r ".result.details.componentFailures"
        sync_branches stage1 stage0
        return 1
    fi
}

deploy_metadata() {
    set -e
    sf deploy metadata -r force-app -x ./manifest/package.xml --target-org ORG
}


# Main execution
branchStage0Name='stage0'
branchStage1Name='main'
branchHomologationName='Homologation'
#branchProductionName='Production'
dependencies_setup

Homologation_sfdxUrlFileContent=$(Homologation_sfdxUrlFileContent) # azure's only
if ! is_script_running_in_hypervisor; then
    Homologation_sfdxUrlFileContent=$(get_web_sfdxUrlFileBase64Content) # local machine
fi
salesforce_authenticate "$Homologation_sfdxUrlFileContent"

if deployment_tests_pass; then
    sync_branches "$branchStage0Name" "$branchStage1Name"
else
    sync_branches "$branchStage1Name" "$branchStage0Name"
fi

deploy_metadata

if_not_exits_create_homologation_branch "$branchHomologationName"
retrieve_from_salesforce_and_commit_changes

exit 0


