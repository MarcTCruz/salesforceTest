#!/bin/bash

# Check if my_function is already defined
if ! declare -F my_function > /dev/null; then
    # Define my_function only if it's not already defined
    my_function() {
        echo "This is my function inside the script."
    }
fi

# Now you can safely call my_function
my_function