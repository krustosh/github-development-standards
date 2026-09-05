const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

const configPath = path.join(
  process.cwd(),
  "config",
  "conventions.yml"
);

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fail(`Configuration file not found: ${configPath}`);
  }

  try {
    return yaml.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`Could not parse conventions.yml: ${error.message}`);
  }
}

function getInput(name, argumentIndex) {
  const argument = process.argv[argumentIndex];

  if (argument) {
    return argument.trim();
  }

  const environmentValue = process.env[name];

  if (environmentValue) {
    return environmentValue.trim();
  }

  return "";
}

function validateTicketId(ticketId, config) {
  if (!ticketId) {
    fail("Jira ticket ID is missing.");
  }

  const pattern = config.jira?.ticket_pattern;

  if (!pattern) {
    fail("Missing jira.ticket_pattern configuration.");
  }

  let regex;

  try {
    regex = new RegExp(pattern);
  } catch (error) {
    fail(`Invalid Jira ticket pattern: ${error.message}`);
  }

  if (!regex.test(ticketId)) {
    fail(`Invalid Jira ticket ID: ${ticketId}`);
  }

  return true;
}

function extractTicketId(branchName, config) {
  const match = branchName.match(
    /(?:^|\/)([A-Z][A-Z0-9]+-[0-9]+)(?:-|$)/
  );

  if (!match) {
    fail(`Could not find Jira ticket ID in branch name: ${branchName}`);
  }

  const ticketId = match[1];

  validateTicketId(ticketId, config);

  return ticketId;
}

function validateBranch(branchName, config) {
  if (!branchName) {
    fail("Branch name is missing.");
  }

  const pattern = config.branches?.pattern;

  if (!pattern) {
    fail("Missing branches.pattern configuration.");
  }

  let regex;

  try {
    regex = new RegExp(pattern);
  } catch (error) {
    fail(`Invalid branch pattern: ${error.message}`);
  }

  if (!regex.test(branchName)) {
    fail(`Invalid branch name: ${branchName}`);
  }

  return extractTicketId(branchName, config);
}

function extractUrls(text) {
  if (!text) {
    return [];
  }

  const urlPattern = /https?:\/\/[^\s<>"'`]+/g;
  const matches = text.match(urlPattern) || [];

  return matches.map((url) =>
    url.replace(/[),.;:]+$/, "")
  );
}

function extractJiraUrl(prBody, ticketId, jiraBaseUrl) {
  if (!prBody) {
    fail("Pull request body is empty.");
  }

  const urls = extractUrls(prBody);

  if (urls.length === 0) {
    fail("No URL was found in the pull request body.");
  }

  let baseUrl;

  try {
    baseUrl = new URL(jiraBaseUrl);
  } catch {
    fail(`Invalid Jira base URL: ${jiraBaseUrl}`);
  }

  const expectedPath = `/browse/${ticketId}`;

  const jiraUrl = urls.find((url) => {
    try {
      const parsedUrl = new URL(url);

      return (
        parsedUrl.origin === baseUrl.origin &&
        parsedUrl.pathname.replace(/\/+$/, "") === expectedPath
      );
    } catch {
      return false;
    }
  });

  if (!jiraUrl) {
    fail(
      `No matching Jira URL for ticket ${ticketId} was found in the pull request body.`
    );
  }

  return jiraUrl;
}

function validateJiraUrl(jiraUrl, ticketId, jiraBaseUrl) {
  if (!jiraUrl) {
    fail("Jira URL is missing from the pull request.");
  }

  if (!jiraBaseUrl) {
    fail("Jira base URL is missing.");
  }

  let baseUrl;
  let actualUrl;

  try {
    baseUrl = new URL(jiraBaseUrl);
  } catch {
    fail(`Invalid Jira base URL: ${jiraBaseUrl}`);
  }

  try {
    actualUrl = new URL(jiraUrl);
  } catch {
    fail(`Invalid Jira URL: ${jiraUrl}`);
  }

  const expectedPath = `/browse/${ticketId}`;

  if (
    actualUrl.origin !== baseUrl.origin ||
    actualUrl.pathname.replace(/\/+$/, "") !== expectedPath
  ) {
    fail(
      `Jira URL does not match ticket ${ticketId}: ${jiraUrl}`
    );
  }

  return true;
}

function validate() {
  const config = loadConfig();

  if (!config.jira?.enabled) {
    console.log("✓ Jira validation is disabled.");
    return;
  }

  const branchName = getInput("BRANCH_NAME", 2);
  const prBody = getInput("PR_BODY", 3);
  const jiraBaseUrl = getInput("JIRA_BASE_URL", 4);

  const ticketId = validateBranch(branchName, config);

  if (config.pull_requests?.require_jira_ticket) {
    validateTicketId(ticketId, config);
  }

  let jiraUrl = "";

  if (config.pull_requests?.require_jira_url) {
    jiraUrl = extractJiraUrl(
      prBody,
      ticketId,
      jiraBaseUrl
    );

    validateJiraUrl(
      jiraUrl,
      ticketId,
      jiraBaseUrl
    );
  }

  console.log("✓ PR governance validation passed.");
  console.log(`✓ Jira ticket: ${ticketId}`);

  if (jiraUrl) {
    console.log(`✓ Jira URL: ${jiraUrl}`);
  }

  console.log(`✓ Jira base URL: ${jiraBaseUrl}`);
  console.log(`✓ Branch: ${branchName}`);
}

validate();
