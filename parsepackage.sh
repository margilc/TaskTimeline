#!/bin/bash

# Check if a folder is provided as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <folder_path>" >&2
  exit 1
fi

folder_path="$1"

# Check if the provided path is a directory
if [ ! -d "$folder_path" ]; then
  echo "Error: '$folder_path' is not a directory." >&2
  exit 1
fi

# Find all .ts files in src folder, concatenate them with separators
find "$folder_path/src" -name "*.ts" -print0 | while IFS= read -r -d $'\0' ts_file; do
  echo "Processing TypeScript file: $ts_file" >&2
  echo "$ts_file"
  echo "#######"
  cat "$ts_file"
  echo "#######"
  echo "" # Add an extra newline for readability
done

# Process style.css if it exists
css_file="$folder_path/styles.css"
if [ -f "$css_file" ]; then
  echo "Processing CSS file: $css_file" >&2
  echo "$css_file"
  echo "#######"
  cat "$css_file"
  echo "#######"
  echo "" # Add an extra newline for readability
fi
# process readme.md
# readme_file="$folder_path/readme.md"
# if [ -f "$readme_file" ]; then
#   echo "Processing README file: $readme_file" >&2
#   echo "$readme_file"
#   echo "#######"
#   cat "$readme_file"
#   echo "#######"
#   echo "" # Add an extra newline for readability
# fi
# # process functional_components.md
# functional_components_file="$folder_path/functional_components.md"
# if [ -f "$functional_components_file" ]; then
#   echo "Processing functional_components.md file: $functional_components_file" >&2
#   echo "$functional_components_file"
#   echo "#######"
#   cat "$functional_components_file"
#   echo "#######"
#   echo "" # Add an extra newline for readability
# fi 
echo "Concatenation complete." >&2

exit 0