#!/bin/bash
echo "Activating conda environment 'website'..."
conda activate website

echo "Updating node to the latest version..."
nvm install node --latest-npm

echo "Updating npm to the latest version..."
npm install -g npm

echo "Checking for outdated packages..."
npm outdated

echo "Updating all packages to their latest versions..."
npm update

echo "Cleaning up npm cache..."
npm cache clean --force

echo "Installing updated dependencies..."
npm install

echo "Update process complete!"
