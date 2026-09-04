const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getRepo() {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }
  try {
    const remote = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const match = remote.match(/github\.com[/:]([^/.]+\/[^/.]+)/);
    if (match) return match[1].replace(/\.git$/, '');
  } catch {}
  return 'nekoo-moe/danser-autofetch';
}

function getFeatures() {
  try {
    const readmePath = path.join(process.cwd(), 'README.md');
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf-8');
      const match = readme.match(/## Strengths & Advantages[^\r\n]*\r?\n\r?\n([\s\S]*?)\r?\n\r?\n---/);
      if (match) {
        return match[1].trim();
      }
    }
  } catch (err) {
    console.warn('Could not extract features from README:', err.message);
  }
  return '- Automated osu! replay video renderer & multi-mirror beatmap fetcher.';
}

function getPreviousTag(currentTag) {
  try {
    const allTags = execSync('git tag --sort=-creatordate', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean);

    for (const t of allTags) {
      if (t !== currentTag) {
        return t;
      }
    }
  } catch {}
  return '';
}

function getBugFixes(repo, prevTag) {
  const fixes = [];
  try {
    const range = prevTag ? `${prevTag}..HEAD` : 'HEAD~15..HEAD';
    const logOutput = execSync(`git log ${range} --pretty=format:"%H|%s"`, { encoding: 'utf-8' }).trim();
    if (logOutput) {
      const lines = logOutput.split('\n');
      for (const line of lines) {
        const pipeIdx = line.indexOf('|');
        if (pipeIdx === -1) continue;
        const hash = line.slice(0, pipeIdx).trim();
        const subject = line.slice(pipeIdx + 1).trim();

        if (/^fix(\([^)]+\))?:/i.test(subject)) {
          fixes.push(`- [${subject}](https://github.com/${repo}/commit/${hash}).`);
        }
      }
    }
  } catch (err) {
    console.warn('Could not extract commit logs:', err.message);
  }

  if (fixes.length === 0) {
    return 'No bug fixes in this release.';
  }
  return fixes.join('\n');
}

function getContributors(prevTag) {
  try {
    const range = prevTag ? `${prevTag}..HEAD` : 'HEAD~15..HEAD';
    const logOutput = execSync(`git log ${range} --pretty=format:"%an"`, { encoding: 'utf-8' }).trim();
    if (logOutput) {
      const authors = logOutput
        .split('\n')
        .map(a => a.trim())
        .filter(a => a && !a.includes('bot') && !a.includes('GitHub Actions'));
      const unique = [...new Set(authors)];
      if (unique.length > 1) {
        return unique.map(a => `- ${a}`).join('\n');
      }
    }
  } catch {}
  return 'No new contributors since latest update.';
}

function main() {
  const tag = process.argv[2] || process.env.RELEASE_TAG || 'v1.3.8';
  const repo = getRepo();
  const prevTag = getPreviousTag(tag);

  console.log(`Generating release notes for ${tag} (previous: ${prevTag || 'none'}, repo: ${repo})...`);

  const features = getFeatures();
  const bugFixes = getBugFixes(repo, prevTag);
  const contributors = getContributors(prevTag);

  const releaseNotes = [
    '# Feature included in this version',
    features,
    '# Bug fixed',
    bugFixes,
    '# Contributors',
    contributors
  ].join('\n');

  const outputPath = path.join(process.cwd(), 'release_notes.md');
  fs.writeFileSync(outputPath, releaseNotes, 'utf-8');
  console.log(`Release notes written to ${outputPath}`);
}

main();
