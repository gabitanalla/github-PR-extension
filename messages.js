// Centralized file for application messages and texts

const MESSAGES = {
  // User status
  USER: {
    LOGGED_IN: "GitHub User:",
    NOT_LOGGED_IN: "No logged user",
    VISIT_GITHUB: "Go to github.com to log in",
  },

  // Tokens
  TOKEN: {
    PLACEHOLDER: "Enter your GitHub Personal Access Token",
    AUTHENTICATED: "Token authenticated",
    SAVED: "Token saved successfully",
    DELETED: "Token deleted",
    ERROR_EMPTY: "Error: Enter a valid token",
    ERROR_INVALID: "Error: Invalid token",
    ERROR_VALIDATION: "Error validating token",
    ERROR_CONNECTION: "Connection error",
  },

  // Repositories
  REPOSITORIES: {
    LOADING: "Loading repositories...",
    NOT_FOUND: "No repositories found",
    SELECT: "Select a repository...",
    ERROR: "Error loading repositories",
  },

  // Pull Requests
  PR: {
    SEARCHING: "Searching for PRs...",
    NO_PENDING: "✓ There are no PRs pending review!",
    PENDING: "📋 {count} PR(s) pending review:",
    ERROR: "Error loading PRs",
    PRIVATE_REPO_WARNING:
      "⚠️ A PAT token is required to access private repositories",
    ACCESS_DENIED:
      "Access denied. Verify that your token has sufficient permissions.",
    REPO_NOT_FOUND: "Repository not found. Verify that you have access.",
    ERROR_STATUS: "Error {status} loading PRs",
    BY: "By:",
    BADGE_TITLE: "{count} PR(s) pending review",
  },

  // Authentication errors
  AUTH: {
    NOT_AUTHENTICATED: "Not authenticated",
    NOT_AUTH_API: "Not authenticated. Please provide a valid token.",
    ERROR_LOADING: "Error loading repositories",
  },

  // Log/console messages
  LOG: {
    REPO_SAVED: "Repository saved in background",
    BADGE_UPDATED: "Badge updated on the icon",
  },

  // Status colors
  STATUS: {
    SUCCESS: "#90EE90",
    ERROR: "#ff6b6b",
    WARNING: "#ffa500",
  },
};

// Helper function to replace placeholders
function formatMessage(template, values = {}) {
  let message = template;
  Object.keys(values).forEach((key) => {
    message = message.replace(`{${key}}`, values[key]);
  });
  return message;
}
