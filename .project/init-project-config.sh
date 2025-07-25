#!/bin/bash

# init-project-config.sh
# Initialize unified project configuration for Claude Code and Gemini CLI

echo "🚀 Initializing unified project configuration..."

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .project directory already exists
if [ -d ".project" ]; then
    echo -e "${YELLOW}Warning: .project directory already exists${NC}"
    read -p "Do you want to overwrite existing configuration? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Configuration initialization cancelled${NC}"
        exit 1
    fi
fi

# Create directories
echo "📁 Creating directory structure..."
mkdir -p .project/contexts
mkdir -p .project/scripts
mkdir -p .claude
mkdir -p .gemini

# Check if we're in a git repository
if [ -d ".git" ]; then
    echo "📝 Updating .gitignore..."
    # Add .env to gitignore if not already present
    if ! grep -q "^\.project/\.env$" .gitignore 2>/dev/null; then
        echo ".project/.env" >> .gitignore
    fi
    # Add .gemini symlinks to gitignore
    if ! grep -q "^\.gemini/GEMINI\.md$" .gitignore 2>/dev/null; then
        echo -e "\n# Gemini symlinks\n.gemini/GEMINI.md\n.gemini/settings.json" >> .gitignore
    fi
fi

# Create environment file from example if it doesn't exist
if [ ! -f ".project/.env" ] && [ -f ".project/.env.example" ]; then
    echo "🔐 Creating .env from .env.example..."
    cp .project/.env.example .project/.env
    echo -e "${YELLOW}Note: Please update .project/.env with your actual values${NC}"
fi

# Create symlinks for Gemini compatibility
echo "🔗 Creating symlinks for tool compatibility..."
ln -sf ../.project/config.md .gemini/GEMINI.md 2>/dev/null
ln -sf ../.project/settings.json .gemini/settings.json 2>/dev/null

# Create Claude project file if it doesn't exist
if [ ! -f ".claude/claude_project.json" ]; then
    echo "📄 Creating Claude project file..."
    cat > .claude/claude_project.json << 'EOF'
{
  "name": "Chess.com Helper",
  "description": "Cloudflare Workers application for Chess.com player monitoring"
}
EOF
fi

# Create a helper script for context updates
echo "🛠️  Creating context update script..."
cat > .project/scripts/update-context.sh << 'EOF'
#!/bin/bash
# Update dynamic context information

echo "Updating project context..."

# Update dependencies from package.json
if [ -f "package.json" ]; then
    node -e "
    const pkg = require('./package.json');
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    
    const content = \`# Dependencies & Versions

## Last Updated
\${new Date().toISOString()}

## Production Dependencies
\${deps.map(dep => \`- \${dep}: \${pkg.dependencies[dep]}\`).join('\\n')}

## Development Dependencies
\${devDeps.map(dep => \`- \${dep}: \${pkg.devDependencies[dep]}\`).join('\\n')}
\`;
    
    require('fs').writeFileSync('.project/contexts/current-dependencies.md', content);
    "
    echo "✅ Dependencies context updated"
fi
EOF

chmod +x .project/scripts/update-context.sh

# Create README for .project directory
cat > .project/README.md << 'EOF'
# Project Configuration

This directory contains unified configuration for AI assistants (Claude Code & Gemini CLI).

## Structure
- `config.md` - Main project context and guidelines
- `settings.json` - Unified project settings
- `.env` - Environment variables (not in version control)
- `contexts/` - Modular context files
  - `architecture.md` - System architecture documentation
  - `coding-standards.md` - Code style and standards
  - `dependencies.md` - Project dependencies and versions

## Usage

### Claude Code
Reference the configuration in your prompts:
```
Please read and follow the guidelines in .project/config.md
```

### Gemini CLI
The configuration is automatically loaded via symlinks in `.gemini/`

## Maintenance
- Run `./init-project-config.sh` to reinitialize
- Update context files as the project evolves
- Keep environment variables in `.env` (copy from `.env.example`)
EOF

echo -e "\n${GREEN}✅ Project configuration initialized successfully!${NC}"
echo -e "\n📚 Next steps:"
echo "  1. Review and update .project/config.md with your project specifics"
echo "  2. Copy .project/.env.example to .project/.env and update values"
echo "  3. Customize context files in .project/contexts/"
echo "  4. Commit the .project directory to version control"
echo -e "\n💡 Tip: Add this to your shell aliases for Claude:"
echo '  alias claude-project="claude \"Please read .project/config.md\""'