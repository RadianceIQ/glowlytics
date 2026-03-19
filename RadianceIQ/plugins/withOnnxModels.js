/**
 * Expo config plugin that copies ONNX model files into the iOS app bundle.
 * Uses withDangerousMod to copy files before the Xcode build, and
 * withXcodeProject to add them to the "Copy Bundle Resources" phase.
 */
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withOnnxModelsCopy(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName;
      const modelsDir = path.join(projectRoot, 'assets', 'models');
      const iosProjectDir = path.join(projectRoot, 'ios', projectName);

      if (!fs.existsSync(modelsDir)) return config;

      const onnxFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.onnx'));
      for (const file of onnxFiles) {
        const src = path.join(modelsDir, file);
        const dest = path.join(iosProjectDir, file);
        fs.copyFileSync(src, dest);
        console.log(`[withOnnxModels] Copied ${file} → ios/${projectName}/`);
      }
      return config;
    },
  ]);
}

function withOnnxModelsXcode(config) {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const projectName = config.modRequest.projectName;
    const modelsDir = path.join(projectRoot, 'assets', 'models');

    if (!fs.existsSync(modelsDir)) return config;

    const onnxFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.onnx'));

    // Find the main group and target
    const targetUuid = project.getFirstTarget().uuid;

    for (const file of onnxFiles) {
      // Generate UUIDs for pbx entries
      const fileRefUuid = project.generateUuid();
      const buildFileUuid = project.generateUuid();

      // Add file reference
      project.addToPbxFileReferenceSection({
        uuid: fileRefUuid,
        isa: 'PBXFileReference',
        lastKnownFileType: '"compiled.mach-o.executable"',
        name: `"${file}"`,
        path: `"${file}"`,
        sourceTree: '"<group>"',
      });

      // Add build file
      project.addToPbxBuildFileSection({
        uuid: buildFileUuid,
        isa: 'PBXBuildFile',
        fileRef: fileRefUuid,
        fileRef_comment: file,
      });

      // Add to resources build phase
      const resourcesBuildPhase = project.pbxResourcesBuildPhaseObj(targetUuid);
      if (resourcesBuildPhase) {
        resourcesBuildPhase.files.push({
          value: buildFileUuid,
          comment: `${file} in Resources`,
        });
      }

      // Add to main group
      const mainGroupUuid = project.getFirstProject().firstProject.mainGroup;
      const mainGroup = project.getPBXGroupByKey(mainGroupUuid);
      if (mainGroup && mainGroup.children) {
        mainGroup.children.push({
          value: fileRefUuid,
          comment: file,
        });
      }

      console.log(`[withOnnxModels] Added ${file} to Xcode resources`);
    }

    return config;
  });
}

module.exports = function withOnnxModels(config) {
  config = withOnnxModelsCopy(config);
  config = withOnnxModelsXcode(config);
  return config;
};
