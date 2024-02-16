#!/bin/bash

# Declare an associative array to hold the required variables
declare -A required_vars=( ["ORG_ALIAS"]="" ["ORG_PATH"]="" )

# Function to check if required variables are set and prompt for missing ones
check_required_variables() {
    for var_name in "${!required_vars[@]}"; do
        if [[ -z "${!var_name}" ]]; then
            echo "The variable '$var_name' must be declared."
            echo "You can set it in the parent shell with the following command:"
            echo "export $var_name=<value>"
            echo "or for many:S"
            echo "export var_name_0=<value> var_name_1=<value> ..."
            echo "Or set a default value in the script."
            return   1
        fi
    done
    return   0
}

# Call the function to check the required variables
if ! check_required_variables; then
    exit  1
fi


chdir_sfdx_project(){
    set -e
    chdir "$ORG_PATH"
}

get_web_sfdxUrlFileBase64Content() {
    set -e
    if ! sf org display --target-org "$ORG_ALIAS" &>/dev/null; then
        sf org login web --alias "$ORG_ALIAS" &>/dev/null
        sf config set target-org "$ORG_ALIAS" &>/dev/null
    fi

    sf org display --target-org "$ORG_ALIAS" --verbose --json | base64 #local sh
}

if ! declare -F Homologation_sfdxUrlFileContent > /dev/null; then
    Homologation_sfdxUrlFileContent() {
        get_web_sfdxUrlFileBase64Content
    }
fi

is_script_running_in_hypervisor() {
    grep -Fwf /sys/hypervisor/uuid /proc/sys/kernel/osrelease &>/dev/null
    return $?
}

dependencies_setup() {
    set -e
    sudo npm install @salesforce/cli --global
    sudo npm install xmldom --global
    chmod +x ~/jq
}

salesforce_authenticate() {
    set -e
    local sfdxUrlFileContent=$1

    AUTH_FILE=$(mktemp --suffix=.json)
    echo "$sfdxUrlFileContent" | base64 --decode >"$AUTH_FILE"
    sf org login sfdx-url --sfdx-url-file "$AUTH_FILE" --set-default --alias "$ORG_ALIAS"
    unlink "$AUTH_FILE"
}

# Function to retrieve and commit changes from sandbox
retrieve_from_salesforce_and_commit_changes() {
    set -e
    local branchName=$1
    local commitMessage=$2
    git switch "$branchName"
    git fetch origin "$branchName"
    node ~/manifestHandler.js ./manifest/package.xml # retrieves all metadata parallelized to speed up process and reduce the chance of hitting 10k files limit.

    git add .
    git push
    git diff --staged --quiet || git commit -m "$commitMessage"
}

if_not_exists_create_branch() {
    set -e
    local branchName=$1

    # Check if the branch exists locally
    if git show-ref --verify --quiet refs/heads/"${branchName}"; then
        echo "Branch ${branchName} already exists locally."
        return  0
    fi

    # Check if the branch exists remotely
    if git ls-remote --heads origin "${branchName}" | grep -q "^refs/heads/${branchName}$"; then
        echo "Branch ${branchName} already exists remotely."
        return  0
    fi

    # Create the branch locally and switch to it
    git switch -c "$branchName"

    # Fetch the newly created branch from the remote
    git fetch origin "$branchName"

    # Generate the Salesforce project and manifest
    currentDir=$(pwd)
    chdir_sfdx_project
    sf project generate --name "$ORG_ALIAS" --template standard
    sf project generate manifest --output-dir ./manifest --from-org "$ORG_ALIAS"
    chdir "$currentDir"
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
    local validationResult=$(sf deploy metadata validate --manifest ./manifest/package.xml --target-org "$ORG_ALIAS" --json)
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
        local statusResult=$(sf deploy metadata report --jobid "$jobId" --target-org "$ORG_ALIAS" --json)
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
    sf deploy metadata -r force-app -x ./manifest/package.xml --target-org "$ORG_ALIAS"
}
