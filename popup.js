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
        Accept: "application/vnd.github.v3+json",
      };
      if (currentToken) {
        headers.Authorization = `Bearer ${currentToken}`;
      }

      fetch("https://api.github.com/user", { headers })
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
          userStatus.innerHTML = `<strong>No hay usuario logueado</strong><br><small style="font-size: 12px;">Visita github.com e inicia sesión</small>`;
          userStatus.style.color = "#fff";
          userStatus.style.marginTop = "15px";
        });
    }
  });

  function displayUser(username) {
    userStatus.innerHTML = `<strong>Usuario GitHub:</strong><br>${username}`;
    userStatus.style.color = "#fff";
    userStatus.style.marginTop = "15px";
  }

  function updateTokenUI() {
    if (currentToken) {
      tokenInput.value = "";
      tokenInput.placeholder = "Token guardado ✓";
      tokenInput.disabled = true;
      saveTokenBtn.style.display = "none";
      clearTokenBtn.style.display = "block";
      tokenStatus.textContent = "Token autenticado";
    } else {
      tokenInput.placeholder = "Ingresa tu GitHub Personal Access Token";
      tokenInput.disabled = false;
      saveTokenBtn.style.display = "block";
      clearTokenBtn.style.display = "none";
      tokenStatus.textContent = "";
    }
  }

  saveTokenBtn.addEventListener("click", function () {
    const token = tokenInput.value.trim();
    if (!token) {
      tokenStatus.textContent = "Error: Ingresa un token válido";
      tokenStatus.style.color = "#ff6b6b";
      return;
    }

    // Validar token
    const headers = {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
    };

    fetch("https://api.github.com/user", { headers })
      .then((response) => {
        if (response.ok) {
          // Token válido
          chrome.storage.local.set({ gitHubToken: token });
          currentToken = token;
          updateTokenUI();
          tokenStatus.textContent = "Token guardado exitosamente";
          tokenStatus.style.color = "#90EE90";
          // Recargar repositorios con el nuevo token
          if (currentUsername) {
            fetchUserRepositories(currentUsername);
          }
        } else if (response.status === 401) {
          tokenStatus.textContent = "Error: Token inválido";
          tokenStatus.style.color = "#ff6b6b";
        } else {
          tokenStatus.textContent = "Error al validar token";
          tokenStatus.style.color = "#ff6b6b";
        }
      })
      .catch((error) => {
        tokenStatus.textContent = "Error de conexión";
        tokenStatus.style.color = "#ff6b6b";
      });
  });

  clearTokenBtn.addEventListener("click", function () {
    chrome.storage.local.remove(["gitHubToken"]);
    currentToken = null;
    tokenInput.value = "";
    updateTokenUI();
    tokenStatus.textContent = "Token eliminado";
    tokenStatus.style.color = "#ffa500";
    // Recargar repositorios sin token
    if (currentUsername) {
      fetchUserRepositories(currentUsername);
    }
  });

  function getHeaders() {
    const headers = {
      Accept: "application/vnd.github.v3+json",
    };
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }
    return headers;
  }

  function fetchUserRepositories(username) {
    repoSelect.innerHTML = '<option value="">Cargando repositorios...</option>';
    repoSelect.disabled = true;

    // Obtener todos los repositorios del usuario autenticado
    // Usando /user/repos incluye: propios, forks y contribuciones
    fetchAllUserRepos([])
      .then((repositories) => {
        if (repositories.length === 0) {
          repoSelect.innerHTML =
            '<option value="">No se encontraron repositorios</option>';
          repoSelect.disabled = true;
        } else {
          // Ordenar por estrellas descendente
          const sortedRepos = repositories.sort((a, b) => b.stars - a.stars);

          repoSelect.innerHTML =
            '<option value="">Selecciona un repositorio...</option>';
          sortedRepos.forEach((repo) => {
            const option = document.createElement("option");
            option.value = repo.url;
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
                    console.log("Repo guardado en background");
                  },
                );
                fetchPullRequestsForReview(selectedRepo);
                // Iniciar revisión periódica solo para este repo
                startPeriodicPRCheckForRepo(selectedRepo);
              }
              this.value = "";
            }
          });
        }

        reposContainer.style.display = "block";
      })
      .catch((error) => {
        console.error("Error:", error);
        repoSelect.innerHTML =
          '<option value="">Error al cargar repositorios</option>';
        repoSelect.disabled = true;
        reposContainer.style.display = "block";
      });

    // Función recursiva para obtener todos los repositorios con paginación
    function fetchAllUserRepos(allRepos, page = 1) {
      const perPage = 100;
      const url = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc&type=all`;

      return fetch(url, {
        headers: getHeaders(),
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else if (response.status === 401) {
            throw new Error(
              "No autenticado. Por favor, proporciona un token válido.",
            );
          } else {
            throw new Error("Error al obtener repositorios");
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
          if (items.length === perPage) {
            return fetchAllUserRepos(combinedRepos, page + 1);
          }

          return combinedRepos;
        });
    }
  }

  function fetchPullRequestsForReview(repo) {
    prContainer.classList.add("show");
    prStatus.textContent = "Buscando PRs...";
    prStatus.classList.add("loading");
    prList.innerHTML = "";

    // Verificar si hay token para repositorios privados
    if (repo.isPrivate && !currentToken) {
      prStatus.textContent =
        "⚠️ Se requiere un token PAT para acceder a repositorios privados";
      prStatus.classList.add("error");
      prStatus.style.color = "#ffa500";
      prList.innerHTML = "";
      return;
    }

    const [owner, repoName] = repo.fullName.split("/");
    const url = `https://api.github.com/search/issues?q=repo:${owner}/${repoName}+is:pr+is:open+review-requested:${currentUsername}`;
    fetch(url, {
      headers: getHeaders(),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else if (response.status === 403) {
          throw new Error(
            "Acceso denegado. Verifica que tu token tenga permisos suficientes.",
          );
        } else if (response.status === 404) {
          throw new Error(
            "Repositorio no encontrado. Verifica que tengas acceso.",
          );
        } else {
          throw new Error(`Error ${response.status} al obtener PRs`);
        }
      })
      .then((data) => {
        // El endpoint de búsqueda ya filtra por review-requested, así que items son los PRs que necesitan revisión
        const prsNeedingReview = data.items || [];

        prStatus.classList.remove("loading");

        if (prsNeedingReview.length === 0) {
          prStatus.textContent = "✓ No hay PRs pendientes de revisión";
          prStatus.classList.remove("error");
          prStatus.style.color = "#90EE90";
          prList.innerHTML = "";
        } else {
          prStatus.textContent = `📋 ${prsNeedingReview.length} PR(s) pendiente(s):`;
          prStatus.style.color = "#ffa500";
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
              <div>Por: <strong>${pr.user.login}</strong></div>
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
        prStatus.textContent = error.message || "Error al cargar PRs";
        prStatus.classList.add("error");
        prStatus.style.color = "#ff6b6b";
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
    prCheckInterval = setInterval(() => checkSingleRepoPRs(repo), 10000);
  }

  function checkSingleRepoPRs(repo) {
    if (!currentUsername) {
      return;
    }

    // No hacer solicitud a repos privados sin token
    if (repo.isPrivate && !currentToken) {
      updatePRBadge(0);
      return;
    }

    const [owner, repoName] = repo.fullName.split("/");
    const url = `https://api.github.com/search/issues?q=repo:${owner}/${repoName}+is:pr+is:open+review-requested:${currentUsername}`;

    fetch(url, {
      headers: getHeaders(),
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          return { items: [] };
        }
      })
      .then((data) => {
        // El endpoint de búsqueda ya filtra por review-requested
        const prsNeedingReview = data.items || [];
        updatePRBadge(prsNeedingReview.length);
      })
      .catch(() => {
        updatePRBadge(0);
      });
  }

  function updatePRBadge(count) {
    if (count > 0) {
      prBadge.classList.add("show");
      prBadge.textContent = count > 99 ? "99+" : count;
      prBadge.title = `${count} PR(s) pendiente(s) de revisar`;
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
          console.log("Badge actualizado en el icono");
        }
      },
    );
  }
});
