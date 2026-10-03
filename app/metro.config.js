// Metro doit pouvoir sortir du dossier app/ pour atteindre le moteur, qui vit dans ../src, et le
// rendu réel du match (../rendu/labo, sa base de mouvements en .bin et son personnage en .glb,
// livrés comme des fichiers à part). Les polices du web (assets/polices, .woff2) partent de même.
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
for (const ext of ['bin', 'glb', 'woff2']) if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);

module.exports = config;
