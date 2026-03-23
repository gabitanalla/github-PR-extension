// Constantes de URLs y configuración
const API_BASE = "https://api.github.com";

// Endpoints
const ENDPOINTS = {
  USER: `${API_BASE}/user`,
  USER_REPOS: `${API_BASE}/user/repos`,
  SEARCH_ISSUES: `${API_BASE}/search/issues`,
};

// Funciones auxiliares para construir URLs
function getUserReposUrl(perPage = 100, page = 1) {
  return `${ENDPOINTS.USER_REPOS}?per_page=${perPage}&page=${page}&sort=updated&direction=desc&type=all`;
}

function getSearchPRsUrl(owner, repoName, username) {
  return `${ENDPOINTS.SEARCH_ISSUES}?q=repo:${owner}/${repoName}+is:pr+is:open+review-requested:${username}`;
}

// Configuración
const CONFIG = {
  REPOS_PER_PAGE: 100,
  CHECK_INTERVAL: 10000, // 10 segundos
  GITHUB_ACCEPT_HEADER: "application/vnd.github.v3+json",
};
