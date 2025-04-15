const path = require('path');
const fs = require('fs/promises');

// Function to extract an archive
async function extract(filePath, options) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(filePath);
  zip.extractAllTo(options.dir, true);
}

// Function to scan a directory for code files
async function scanDirectory(dir, files, baseDir = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(baseDir, entry.name);
    
    if (entry.isDirectory()) {
      await scanDirectory(fullPath, files, relativePath);
    } else if (isCodeFile(entry.name)) {
      const content = await fs.readFile(fullPath, 'utf8');
      files.push({
        path: relativePath,
        content: content
      });
    }
  }
}

// Function to check if a file is a code file
function isCodeFile(filename) {
  const codeExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
    '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.cs', '.m', '.sh'
  ];
  return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

module.exports = {
  extract,
  scanDirectory
}; 