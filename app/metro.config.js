// Metro doit pouvoir sortir du dossier app/ pour atteindre le moteur, qui vit dans ../src.
// C'est tout ce que ce fichier fait : lui ouvrir la porte du dossier parent.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
