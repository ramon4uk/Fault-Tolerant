// Script to generate static diagram images
const { execSync } = require('child_process');
const fs = require('fs');

// Extract Mermaid diagrams from README and generate PNGs
const readme = fs.readFileSync('README.md', 'utf8');
const mermaidBlocks = readme.match(/```mermaid([\s\S]*?)```/g);

if (mermaidBlocks) {
  mermaidBlocks.forEach((block, index) => {
    const diagram = block.replace(/```mermaid\n?/, '').replace(/```$/, '');
    const filename = `diagram-${index + 1}.mmd`;
    const outputFile = `diagram-${index + 1}.png`;
    
    fs.writeFileSync(filename, diagram);
    
    try {
      execSync(`mmdc -i ${filename} -o ${outputFile} -t dark -b transparent`);
      console.log(`Generated: ${outputFile}`);
      fs.unlinkSync(filename); // Clean up temp file
    } catch (error) {
      console.error(`Error generating ${outputFile}:`, error.message);
    }
  });
} else {
  console.log('No Mermaid diagrams found in README.md');
}