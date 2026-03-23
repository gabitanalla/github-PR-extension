// Service Worker para manejar el badge del icono de la extensión
importScripts("constants.js");
importScripts("messages.js");

let selectedRepository = null;
let currentToken = null;
let currentUsername = null;
let prCheckInterval = null;
let isCheckingActive = false;

// Al iniciar, cargar datos del storage
chrome.storage.local.get(
  ["selectedRepository", "gitHubToken", "gitHubUser"],
  function (result) {
    console.log("Datos cargados del storage:", result);
    selectedRepository = result.selectedRepository || null;
    currentToken = result.gitHubToken || null;
    currentUsername = result.gitHubUser || null;

    // Si hay un repo seleccionado, comenzar a revisar
    if (selectedRepository && currentUsername) {
      console.log(
        "Iniciando verificación con repo:",
        selectedRepository.fullName,
      );
      startBackgroundPRCheck();
    }
  },
);

// Escuchar cambios en el storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.gitHubToken) {
      currentToken = changes.gitHubToken.newValue || null;
    }
    if (changes.gitHubUser) {
      currentUsername = changes.gitHubUser.newValue || null;
    }
    if (changes.selectedRepository) {
      selectedRepository = changes.selectedRepository.newValue || null;
      // Si el repo cambió y hay username, reiniciar la verificación
      if (selectedRepository && currentUsername) {
        if (prCheckInterval) {
          clearInterval(prCheckInterval);
        }
        startBackgroundPRCheck();
      }
    }
  }
});

// Escuchar mensajes desde el popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    updateIconBadge(request.count);
    sendResponse({ success: true });
  } else if (request.action === "clearBadge") {
    clearIconBadge();
    sendResponse({ success: true });
  } else if (request.action === "setSelectedRepository") {
    console.log("Recibido nuevo repo:", request.repo.fullName);
    selectedRepository = request.repo;
    currentUsername = request.username;

    // Guardar en storage
    chrome.storage.local.set({ selectedRepository: request.repo });

    // Iniciar revisión en background
    isCheckingActive = false;
    if (prCheckInterval) {
      clearInterval(prCheckInterval);
    }
    startBackgroundPRCheck();
    sendResponse({ success: true });
  }
});

function startBackgroundPRCheck() {
  if (!selectedRepository || !currentUsername) {
    console.log("No se puede iniciar verificación: repo o username faltante");
    return;
  }

  if (isCheckingActive) {
    console.log("Verificación ya está activa");
    return;
  }

  console.log(
    "Iniciando verificación periódica para:",
    selectedRepository.fullName,
  );
  isCheckingActive = true;

  // Hacer la primera verificación inmediatamente
  checkBackgroundPRs();

  // Luego revisar cada 10 segundos
  if (prCheckInterval) {
    clearInterval(prCheckInterval);
  }
  prCheckInterval = setInterval(() => {
    console.log("Verificando PRs de:", selectedRepository.fullName);
    checkBackgroundPRs();
  }, CONFIG.CHECK_INTERVAL);
}

function checkBackgroundPRs() {
  if (!selectedRepository || !currentUsername) {
    console.log("No hay repo o username para verificar");
    return;
  }

  console.log(
    "Verificando PRs en background para:",
    selectedRepository.fullName,
  );

  // No hacer solicitud a repos privados sin token
  if (selectedRepository.isPrivate && !currentToken) {
    console.log("Repo privado sin token");
    updateIconBadge(0);
    return;
  }

  const [owner, repoName] = selectedRepository.fullName.split("/");
  const headers = {
    Accept: CONFIG.GITHUB_ACCEPT_HEADER,
  };
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const url = getSearchPRsUrl(owner, repoName, currentUsername);
  console.log(
    "Background checking PRs. URL:",
    url,
    "With token:",
    !!currentToken,
  );

  fetch(url, { headers })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        console.warn(
          "Background PR check failed with status:",
          response.status,
        );
        return { items: [] };
      }
    })
    .then((data) => {
      // El endpoint de búsqueda ya filtra por review-requested
      const prsNeedingReview = data.items || [];
      console.log(
        `PRs encontrados: ${prsNeedingReview.length} de ${data.total_count}`,
      );
      updateIconBadge(prsNeedingReview.length);
    })
    .catch((error) => {
      console.error("Error al verificar PRs en background:", error);
      updateIconBadge(0);
    });
}

function updateIconBadge(count) {
  console.log("Actualizando badge con count:", count);
  if (count > 0) {
    const badgeText = count > 99 ? "99+" : count.toString();
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
    chrome.action.setTitle({ title: `${count} PR(s) pending review` });
    console.log("Badge actualizado:", badgeText);
  } else {
    clearIconBadge();
  }
}

function clearIconBadge() {
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setTitle({ title: "GitHub PR Extension" });
}
