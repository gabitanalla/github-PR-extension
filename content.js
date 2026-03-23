// Script de contenido que captura el usuario de GitHub
// Ejecuta en el contexto de github.com

function extractGitHubUser() {
  // Intenta obtener el usuario desde el elemento data-login
  const userElement = document.querySelector("[data-login]");
  if (userElement) {
    const username = userElement.getAttribute("data-login");
    chrome.storage.local.set({ gitHubUser: username });
    return;
  }

  // Intenta obtener desde el atributo aria-label
  const profileButton = document.querySelector(
    'button[aria-label*="View profile"]',
  );
  if (profileButton) {
    const ariaLabel = profileButton.getAttribute("aria-label");
    const match = ariaLabel.match(/View profile of (.+)/);
    if (match) {
      chrome.storage.local.set({ gitHubUser: match[1] });
      return;
    }
  }

  // Intenta obtener desde el enlace del perfil
  const profileLink = document.querySelector(
    'a[href^="/"][data-hovercard-type="user"]',
  );
  if (profileLink) {
    const username = profileLink.getAttribute("href").substring(1);
    chrome.storage.local.set({ gitHubUser: username });
    return;
  }

  // Última opción: busca en el menú de usuario
  const userMenuItems = document.querySelectorAll(
    '[data-test-id="profile-menu"]',
  );
  if (userMenuItems.length > 0) {
    const firstLink = userMenuItems[0].querySelector('a[href^="/"]');
    if (firstLink) {
      const username = firstLink.getAttribute("href").substring(1);
      chrome.storage.local.set({ gitHubUser: username });
      return;
    }
  }
}

// Ejecuta la función cuando el DOM está listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", extractGitHubUser);
} else {
  extractGitHubUser();
}

// Re-ejecuta cada 2 segundos para detectar cambios
setInterval(extractGitHubUser, 2000);
