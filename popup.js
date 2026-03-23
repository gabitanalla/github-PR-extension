// Script del popup que muestra el usuario de GitHub y sus repositorios
document.addEventListener("DOMContentLoaded", function () {
  const userStatus = document.getElementById("userStatus");
  const reposContainer = document.getElementById("reposContainer");
  const repoSelect = document.getElementById("repoSelect");
  const tokenInput = document.getElementById("tokenInput");
  const saveTokenBtn = document.getElementById("saveTokenBtn");
  const clearTokenBtn = document.getElementById("clearTokenBtn");
  const tokenStatus = document.getElementById("tokenStatus");
  const prContainer = document.getElementById("prContainer");
  const prStatus = document.getElementById("prStatus");
  const prList = document.getElementById("prList");
  const prBadge = document.getElementById("prBadge");

  let currentUsername = null;
  let currentToken = null;
  let allRepositories = [];
  let prCheckInterval = null;

  // Cargar token almacenado
  chrome.storage.local.get(["gitHubToken"], function (result) {
    if (result.gitHubToken) {
      currentToken = result.gitHubToken;
      updateTokenUI();
    }
  });

  // Intenta obtener el usuario del almacenamiento
  chrome.storage.local.get(["gitHubUser"], function (result) {
    if (result.gitHubUser) {
      currentUsername = result.gitHubUser;
      displayUser(currentUsername);
      fetchUserRepositories(currentUsername);
    } else {
      // Si no hay usuario guardado, intenta obtenerlo de la API de GitHub
      const headers = {
        Accept: CONFIG.GITHUB_ACCEPT_HEADER,
      };
      if (currentToken) {
        headers.Authorization = `Bearer ${currentToken}`;
      }

      fetch(ENDPOINTS.USER, { headers })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error("No autenticado");
          }
        })
        .then((data) => {
          chrome.storage.local.set({ gitHubUser: data.login });
          currentUsername = data.login;
          displayUser(currentUsername);
          fetchUserRepositories(currentUsername);
        })
        .catch((error) => {
          userStatus.innerHTML = `<strong>${MESSAGES.USER.NOT_LOGGED_IN}</strong><br><small style="font-size: 12px;">${MESSAGES.USER.VISIT_GITHUB}</small>`;
          userStatus.style.color = "#fff";
          userStatus.style.marginTop = "15px";
        });
    }
  });

  function displayUser(username) {
    userStatus.innerHTML = `<strong>${MESSAGES.USER.LOGGED_IN}</strong><br>${username}`;
    userStatus.style.color = "#fff";
    userStatus.style.marginTop = "15px";
  }

  function updateTokenUI() {
    if (currentToken) {
      tokenInput.style.display = "none";
      saveTokenBtn.style.display = "none";
      clearTokenBtn.style.display = "block";
      tokenStatus.textContent = MESSAGES.TOKEN.AUTHENTICATED;
    } else {
      tokenInput.style.display = "block";
      tokenInput.placeholder = MESSAGES.TOKEN.PLACEHOLDER;
      tokenInput.disabled = false;
      saveTokenBtn.style.display = "block";
      clearTokenBtn.style.display = "none";
      tokenStatus.textContent = "";
    }
  }

  saveTokenBtn.addEventListener("click", function () {
    const token = tokenInput.value.trim();
    if (!token) {
      tokenStatus.textContent = MESSAGES.TOKEN.ERROR_EMPTY;
      tokenStatus.style.color = MESSAGES.STATUS.ERROR;
      return;
    }

    // Validar token
    const headers = {
      Accept: CONFIG.GITHUB_ACCEPT_HEADER,
      Authorization: `Bearer ${token}`,
    };

    fetch(ENDPOINTS.USER, { headers })
      .then((response) => {
        if (response.ok) {
          // Token válido
          chrome.storage.local.set({ gitHubToken: token });
          currentToken = token;
          updateTokenUI();
          tokenStatus.textContent = MESSAGES.TOKEN.SAVED;
          tokenStatus.style.color = MESSAGES.STATUS.SUCCESS;
          // Recargar repositorios con el nuevo token
          if (currentUsername) {
            fetchUserRepositories(currentUsername);
          }
        } else if (response.status === 401) {
          tokenStatus.textContent = MESSAGES.TOKEN.ERROR_INVALID;
          tokenStatus.style.color = MESSAGES.STATUS.ERROR;
        } else {
          tokenStatus.textContent = MESSAGES.TOKEN.ERROR_VALIDATION;
          tokenStatus.style.color = MESSAGES.STATUS.ERROR;
        }
      })
      .catch((error) => {
        tokenStatus.textContent = MESSAGES.TOKEN.ERROR_CONNECTION;
        tokenStatus.style.color = MESSAGES.STATUS.ERROR;
      });
  });

  clearTokenBtn.addEventListener("click", function () {
    chrome.storage.local.remove(["gitHubToken"]);
    currentToken = null;
    tokenInput.value = "";
    updateTokenUI();
    tokenStatus.textContent = MESSAGES.TOKEN.DELETED;
    tokenStatus.style.color = MESSAGES.STATUS.WARNING;
    // Recargar repositorios sin token
    if (currentUsername) {
      fetchUserRepositories(currentUsername);
    }
  });

  function getHeaders() {
    const headers = {
      Accept: CONFIG.GITHUB_ACCEPT_HEADER,
    };
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }
    return headers;
  }

  function fetchUserRepositories(username) {
    repoSelect.innerHTML = `<option value="">${MESSAGES.REPOSITORIES.LOADING}</option>`;
    repoSelect.disabled = true;

    // Obtener todos los repositorios del usuario autenticado
    // Usando /user/repos incluye: propios, forks y contribuciones
    fetchAllUserRepos([])
      .then((repositories) => {
        if (repositories.length === 0) {
          repoSelect.innerHTML = `<option value="">${MESSAGES.REPOSITORIES.NOT_FOUND}</option>`;
          repoSelect.disabled = true;
        } else {
          // Ordenar por estrellas descendente
          const sortedRepos = repositories.sort((a, b) => b.stars - a.stars);

          repoSelect.innerHTML = `<option value="">${MESSAGES.REPOSITORIES.SELECT}</option>`;
          sortedRepos.forEach((repo) => {
            const option = document.createElement("option");
            option.value = repo.url;
            option.selected = false;
            option.textContent = `${repo.fullName} (⭐ ${repo.stars})`;
            repoSelect.appendChild(option);
          });
          repoSelect.disabled = false;
          allRepositories = sortedRepos;

          // Cargar repositorio guardado si existe
          chrome.storage.local.get(["selectedRepository"], function (result) {
            if (result.selectedRepository) {
              const savedRepo = result.selectedRepository;
              // Buscar el repo guardado en la lista actual
              const foundRepo = allRepositories.find(
                (r) => r.fullName === savedRepo.fullName,
              );
              if (foundRepo) {
                // Seleccionar el repo guardado
                repoSelect.value = foundRepo.url;
                // Mostrar PRs del repo guardado
                fetchPullRequestsForReview(foundRepo);
                // Reiniciar revisión periódica
                startPeriodicPRCheckForRepo(foundRepo);
              }
            }
          });

          // Evento para seleccionar repositorio y ver PRs
          repoSelect.addEventListener("change", function () {
            if (this.value) {
              // Encontrar el repo seleccionado
              const selectedRepo = allRepositories.find(
                (r) => r.url === this.value,
              );
              if (selectedRepo) {
                // Guardar el repositorio seleccionado en storage
                chrome.storage.local.set({ selectedRepository: selectedRepo });
                // Notificar al background script
                chrome.runtime.sendMessage(
                  {
                    action: "setSelectedRepository",
                    repo: selectedRepo,
                    username: currentUsername,
                  },
                  (response) => {
                    console.log(MESSAGES.LOG.REPO_SAVED);
                  },
                );
                fetchPullRequestsForReview(selectedRepo);
                // Iniciar revisión periódica solo para este repo
                startPeriodicPRCheckForRepo(selectedRepo);
              }
            }
          });
        }

        reposContainer.style.display = "block";
      })
      .catch((error) => {
        console.error("Error:", error);
        repoSelect.innerHTML = `<option value="">${MESSAGES.REPOSITORIES.ERROR}</option>`;
        repoSelect.disabled = true;
        reposContainer.style.display = "block";
      });

    // Función recursiva para obtener todos los repositorios con paginación
    function fetchAllUserRepos(allRepos, page = 1) {
      const url = getUserReposUrl(CONFIG.REPOS_PER_PAGE, page);

      return fetch(url, {
        headers: getHeaders(),
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else if (response.status === 401) {
            throw new Error(MESSAGES.AUTH.NOT_AUTH_API);
          } else {
            throw new Error(MESSAGES.AUTH.ERROR_LOADING);
          }
        })
        .then((data) => {
          const items = Array.isArray(data) ? data : [];

          // Transformar los resultados a nuestro formato
          const repos = items.map((item) => ({
            name: item.name,
            fullName: item.full_name,
            url: item.html_url,
            stars: item.stargazers_count || 0,
            isPrivate: item.private || false,
          }));

          const combinedRepos = [...allRepos, ...repos];

          // Verificar si hay más páginas
          if (items.length === CONFIG.REPOS_PER_PAGE) {
            return fetchAllUserRepos(combinedRepos, page + 1);
          }

          return combinedRepos;
        });
    }
  }

  function fetchPullRequestsForReview(repo) {
    prContainer.classList.add("show");
    prStatus.textContent = MESSAGES.PR.SEARCHING;
    prStatus.classList.add("loading");
    prList.innerHTML = "";

    // Verificar si hay token para repositorios privados
    if (repo.isPrivate && !currentToken) {
      prStatus.textContent = MESSAGES.PR.PRIVATE_REPO_WARNING;
      prStatus.classList.add("error");
      prStatus.style.color = MESSAGES.STATUS.WARNING;
      prList.innerHTML = "";
      return;
    }

    const [owner, repoName] = repo.fullName.split("/");
    const url = getSearchPRsUrl(owner, repoName, currentUsername);
    fetch(url, {
      headers: getHeaders(),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else if (response.status === 403) {
          throw new Error(MESSAGES.PR.ACCESS_DENIED);
        } else if (response.status === 404) {
          throw new Error(MESSAGES.PR.REPO_NOT_FOUND);
        } else {
          throw new Error(
            formatMessage(MESSAGES.PR.ERROR_STATUS, {
              status: response.status,
            }),
          );
        }
      })
      .then((data) => {
        // El endpoint de búsqueda ya filtra por review-requested, así que items son los PRs que necesitan revisión
        const prsNeedingReview = data.items || [];

        prStatus.classList.remove("loading");

        if (prsNeedingReview.length === 0) {
          prStatus.textContent = MESSAGES.PR.NO_PENDING;
          prStatus.classList.remove("error");
          prStatus.style.color = MESSAGES.STATUS.SUCCESS;
          prList.innerHTML = "";
        } else {
          prStatus.textContent = formatMessage(MESSAGES.PR.PENDING, {
            count: prsNeedingReview.length,
          });
          prStatus.style.color = MESSAGES.STATUS.WARNING;
          prStatus.classList.remove("error");
          prList.innerHTML = "";

          prsNeedingReview.forEach((pr) => {
            const prItem = document.createElement("div");
            prItem.className = "pr-item";
            const prTitle = document.createElement("div");
            prTitle.className = "pr-title";
            prTitle.textContent = pr.title;

            const prInfo = document.createElement("div");
            prInfo.className = "pr-info";
            prInfo.innerHTML = `
              <div>${MESSAGES.PR.BY} <strong>${pr.user.login}</strong></div>
              <div style="margin-top: 4px;">
                <a href="${pr.html_url}" target="_blank" class="pr-link">#${pr.number}</a> - 
                <span>${new Date(pr.created_at).toLocaleDateString()}</span>
              </div>
            `;

            prItem.appendChild(prTitle);
            prItem.appendChild(prInfo);
            prList.appendChild(prItem);
          });
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        prStatus.textContent = error.message || MESSAGES.PR.ERROR;
        prStatus.classList.add("error");
        prStatus.style.color = MESSAGES.STATUS.ERROR;
        prList.innerHTML = "";
      });
  }

  function startPeriodicPRCheck() {
    // Limpiar intervalo anterior si existe
    if (prCheckInterval) {
      clearInterval(prCheckInterval);
    }

    // Hacer la primera verificación inmediatamente
    checkAllPRs();

    // Luego revisar cada 10 segundos
    prCheckInterval = setInterval(checkAllPRs, 10000);
  }

  function startPeriodicPRCheckForRepo(repo) {
    // Limpiar intervalo anterior si existe
    if (prCheckInterval) {
      clearInterval(prCheckInterval);
    }

    // Hacer la primera verificación inmediatamente
    checkSingleRepoPRs(repo);

    // Luego revisar cada 10 segundos solo este repositorio
    prCheckInterval = setInterval(
      () => checkSingleRepoPRs(repo),
      CONFIG.CHECK_INTERVAL,
    );
  }

  function checkSingleRepoPRs(repo) {
    if (!currentUsername) {
      console.warn("Username not set, cannot check PRs");
      return;
    }

    // No hacer solicitud a repos privados sin token
    if (repo.isPrivate && !currentToken) {
      console.warn("Private repo without token, skipping check");
      updatePRBadge(0);
      return;
    }

    const [owner, repoName] = repo.fullName.split("/");
    const url = getSearchPRsUrl(owner, repoName, currentUsername);
    console.log("Checking PRs for:", repo.fullName, "URL:", url);

    fetch(url, {
      headers: getHeaders(),
    })
      .then((response) => {
        console.log("PR check response status:", response.status);
        if (response.ok) {
          return response.json();
        } else {
          console.warn("PR check failed with status:", response.status);
          return { items: [] };
        }
      })
      .then((data) => {
        // El endpoint de búsqueda ya filtra por review-requested
        const prsNeedingReview = data.items || [];
        console.log("PRs found:", prsNeedingReview.length);
        updatePRBadge(prsNeedingReview.length);
      })
      .catch((error) => {
        console.error("Error checking PRs:", error);
        updatePRBadge(0);
      });
  }

  function updatePRBadge(count) {
    if (count > 0) {
      prBadge.classList.add("show");
      prBadge.textContent = count > 99 ? "99+" : count;
      prBadge.title = formatMessage(MESSAGES.PR.BADGE_TITLE, { count: count });
    } else {
      prBadge.classList.remove("show");
      prBadge.textContent = "";
      prBadge.title = "";
    }

    // Enviar mensaje al background script para actualizar el badge del icono
    chrome.runtime.sendMessage(
      { action: "updateBadge", count: count },
      (response) => {
        if (response && response.success) {
          console.log(MESSAGES.LOG.BADGE_UPDATED);
        }
      },
    );
  }
});
