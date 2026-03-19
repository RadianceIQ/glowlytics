/**
 * Expo config plugin that copies ONNX model files into the iOS app bundle.
 *
 * Copies .onnx files from assets/models/ into the iOS project and adds
 * them to the Xcode project's "Copy Bundle Resources" build phase.
 */
const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withOnnxModels(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName;
      const modelsDir = path.join(projectRoot, 'assets', 'models');
      const iosDir = path.join(projectRoot, 'ios');
      const iosProjectDir = path.join(iosDir, projectName);
      const pbxprojPath = path.join(iosDir, `${projectName}.xcodeproj`, 'project.pbxproj');

      if (!fs.existsSync(modelsDir)) {
        console.warn('[withOnnxModels] No assets/models directory found');
        return config;
      }

      const onnxFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.onnx'));
      if (onnxFiles.length === 0) {
        console.warn('[withOnnxModels] No .onnx files found');
        return config;
      }

      // Read the pbxproj file
      let pbx = fs.readFileSync(pbxprojPath, 'utf8');

      for (const file of onnxFiles) {
        // 1. Copy file into iOS project directory
        const src = path.join(modelsDir, file);
        const dest = path.join(iosProjectDir, file);
        fs.copyFileSync(src, dest);
        console.log(`[withOnnxModels] Copied ${file} → ios/${projectName}/`);

        // Skip if already added (re-running prebuild)
        if (pbx.includes(file)) {
          console.log(`[withOnnxModels] ${file} already in pbxproj, skipping`);
          continue;
        }

        // 2. Generate deterministic UUIDs from filename
        const hash = (s) => {
          let h = 0;
          for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
          return Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
        };
        const fileRefId = `AA${hash(file + 'ref')}${hash(file)}`.slice(0, 24);
        const buildFileId = `BB${hash(file + 'build')}${hash(file)}`.slice(0, 24);

        // 3. Add PBXFileReference
        const fileRefEntry = `\t\t${fileRefId} /* ${file} */ = {isa = PBXFileReference; lastKnownFileType = file; path = ${file}; sourceTree = "<group>"; };`;
        pbx = pbx.replace(
          '/* End PBXFileReference section */',
          `${fileRefEntry}\n/* End PBXFileReference section */`
        );

        // 4. Add PBXBuildFile
        const buildFileEntry = `\t\t${buildFileId} /* ${file} in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ${file} */; };`;
        pbx = pbx.replace(
          '/* End PBXBuildFile section */',
          `${buildFileEntry}\n/* End PBXBuildFile section */`
        );

        // 5. Add to Resources build phase
        pbx = pbx.replace(
          /(\s*\/\* Resources \*\/ = \{[^}]*files = \(\s*)/,
          `$1${buildFileId} /* ${file} in Resources */,\n\t\t\t\t`
        );

        // 6. Add to main group children
        const mainGroupRegex = new RegExp(
          `(${projectName} \\/\\* ${projectName} \\*\\/ = \\{[^}]*children = \\(\\s*)`
        );
        if (mainGroupRegex.test(pbx)) {
          pbx = pbx.replace(
            mainGroupRegex,
            `$1${fileRefId} /* ${file} */,\n\t\t\t\t`
          );
        } else {
          // Fallback: add to the first group that has the project's source files
          const groupRegex = /(children = \(\s*(?:.*AppDelegate.*\n))/;
          if (groupRegex.test(pbx)) {
            pbx = pbx.replace(
              groupRegex,
              `$1\t\t\t\t${fileRefId} /* ${file} */,\n`
            );
          }
        }

        console.log(`[withOnnxModels] Added ${file} to Xcode project (ref=${fileRefId}, build=${buildFileId})`);
      }

      // Write modified pbxproj
      fs.writeFileSync(pbxprojPath, pbx, 'utf8');
      console.log('[withOnnxModels] Updated project.pbxproj');

      return config;
    },
  ]);
};
