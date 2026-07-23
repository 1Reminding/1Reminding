import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "1Reminding";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${owner}-profile-dashboard`,
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const [profile, repositories] = await Promise.all([
  github(`/users/${owner}`),
  github(`/users/${owner}/repos?per_page=100&type=owner&sort=updated`),
]);

const ownedRepositories = repositories.filter((repository) => !repository.fork);
const totalStars = ownedRepositories.reduce((sum, repository) => sum + repository.stargazers_count, 0);
const totalForks = ownedRepositories.reduce((sum, repository) => sum + repository.forks_count, 0);
const topRepositories = [...ownedRepositories]
  .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count)
  .slice(0, 4);
const maxStars = Math.max(1, ...topRepositories.map((repository) => repository.stargazers_count));

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const compact = (value) => new Intl.NumberFormat("en", {
  notation: value >= 1000 ? "compact" : "standard",
  maximumFractionDigits: 1,
}).format(value);

const metrics = [
  ["STARS EARNED", totalStars, "★", "#fbbf24"],
  ["FOLLOWERS", profile.followers, "●", "#a78bfa"],
  ["PUBLIC REPOS", profile.public_repos, "◆", "#22d3ee"],
  ["REPOSITORY FORKS", totalForks, "⑂", "#34d399"],
];

const metricCards = metrics.map(([label, value, icon, color], index) => {
  const x = 34 + index * 216;
  return `
    <g transform="translate(${x} 92)">
      <rect width="198" height="92" rx="14" fill="url(#card)" stroke="#30363d"/>
      <text x="18" y="31" fill="#8b949e" font-size="11" font-weight="700" letter-spacing="1.2">${label}</text>
      <text x="18" y="70" fill="#f0f6fc" font-size="31" font-weight="750">${compact(value)}</text>
      <text x="168" y="65" fill="${color}" font-size="25" text-anchor="middle">${icon}</text>
    </g>`;
}).join("");

const repositoryRows = topRepositories.map((repository, index) => {
  const y = 242 + index * 40;
  const barWidth = Math.max(8, Math.round((repository.stargazers_count / maxStars) * 270));
  return `
    <g transform="translate(38 ${y})">
      <text x="0" y="14" fill="#c9d1d9" font-size="14" font-weight="650">${escapeXml(repository.name)}</text>
      <rect x="300" y="2" width="270" height="12" rx="6" fill="#21262d"/>
      <rect x="300" y="2" width="${barWidth}" height="12" rx="6" fill="url(#bar)"/>
      <text x="594" y="14" fill="#fbbf24" font-size="13">★ ${repository.stargazers_count}</text>
      <text x="664" y="14" fill="#8b949e" font-size="13">⑂ ${repository.forks_count}</text>
    </g>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="430" viewBox="0 0 920 430" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(owner)} open-source impact dashboard</title>
  <desc id="description">Total stars, followers, public repositories, forks, and leading repositories.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d1117"/>
      <stop offset="0.55" stop-color="#101525"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#161b22"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#8b5cf6"/>
      <stop offset="0.55" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop stop-color="#7c3aed" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#30363d" stroke-opacity="0.32"/>
    </pattern>
  </defs>
  <rect width="920" height="430" rx="20" fill="url(#background)"/>
  <rect width="920" height="430" rx="20" fill="url(#grid)"/>
  <circle cx="820" cy="50" r="180" fill="url(#glow)"/>
  <rect x="1" y="1" width="918" height="428" rx="19" fill="none" stroke="#30363d"/>
  <text x="34" y="45" fill="#f0f6fc" font-size="22" font-weight="750" letter-spacing="0.6">OPEN-SOURCE IMPACT</text>
  <text x="34" y="68" fill="#8b949e" font-size="12">github.com/${escapeXml(owner)} · built from the GitHub API</text>
  <g transform="translate(854 44)">
    <circle r="4" fill="#22d3ee"/>
    <circle r="11" fill="none" stroke="#22d3ee" stroke-opacity="0.36"/>
    <circle r="20" fill="none" stroke="#22d3ee" stroke-opacity="0.16"/>
  </g>
  ${metricCards}
  <text x="34" y="218" fill="#f0f6fc" font-size="15" font-weight="700" letter-spacing="0.8">TOP REPOSITORIES BY STARS</text>
  ${repositoryRows}
  <line x1="34" y1="405" x2="886" y2="405" stroke="#30363d"/>
  <text x="34" y="421" fill="#6e7681" font-size="10">Automatically refreshed when GitHub statistics change</text>
  <text x="886" y="421" fill="#6e7681" font-size="10" text-anchor="end">${escapeXml(owner)} / profile</text>
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/open-source-dashboard.svg", svg, "utf8");
console.log(`Generated dashboard: ${totalStars} stars across ${ownedRepositories.length} original repositories.`);
