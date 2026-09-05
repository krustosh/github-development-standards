const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

const configPath = path.join(
  process.cwd(),
  "config",
  "conventions.yml"
);

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    console.error(`✗ Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    return yaml.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error("✗ Could not parse conventions.yml");
    console.error(error.message);
    process.exit(1);
  }
}

function getCommitMessage() {
  const commitMessageFile = process.argv[2];

  if (commitMessageFile) {
    if (!fs.existsSync(commitMessageFile)) {
      console.error(
        `✗ Commit message file not found: ${commitMessageFile}`
      );
      process.exit(1);
    }

    return fs.readFileSync(commitMessageFile, "utf8").trim();
  }

  const message = process.env.COMMIT_MESSAGE;

  if (!message) {
    console.error(
      "✗ No commit message supplied.\n\n" +
      "Usage:\n" +
      "  node scripts/validate-commit.js <commit-message-file>\n\n" +
      "Or:\n" +
      "  COMMIT_MESSAGE=\"feat: add product API\" node scripts/validate-commit.js"
    );
    process.exit(1);
  }

  return message.trim();
}

function validateCommitMessage(message, config) {
  if (!message) {
    console.error("✗ Commit message cannot be empty.");
    return false;
  }

  const commitsConfig = config.commits;

  if (!commitsConfig) {
    console.error("✗ Missing 'commits' configuration.");
    return false;
  }

  const allowedTypes = commitsConfig.allowed_types;

  if (
    !Array.isArray(allowedTypes) ||
    allowedTypes.length === 0
  ) {
    console.error(
      "✗ 'commits.allowed_types' must contain at least one commit type."
    );
    return false;
  }

  const pattern = commitsConfig.pattern;

  if (!pattern) {
    console.error("✗ Missing commit validation pattern.");
    return false;
  }

  let regex;

  try {
    regex = new RegExp(pattern);
  } catch (error) {
    console.error("✗ Invalid commit validation pattern.");
    console.error(error.message);
    return false;
  }

  const firstLine = message.split(/\r?\n/)[0].trim();

  if (!regex.test(firstLine)) {
    console.error("✗ Invalid commit message.");
    console.error(`  Message: ${firstLine}`);
    console.error("");
    console.error("Expected format:");
    console.error("  <type>: <description>");
    console.error("");
    console.error("Allowed types:");
    console.error(`  ${allowedTypes.join(", ")}`);

    return false;
  }

  const type = firstLine.split(":")[0];

  if (!allowedTypes.includes(type)) {
    console.error(`✗ Invalid commit type: ${type}`);
    console.error("");
    console.error("Allowed types:");
    console.error(`  ${allowedTypes.join(", ")}`);

    return false;
  }

  console.log("✓ Commit message is valid.");
  console.log(`✓ Type: ${type}`);
  console.log(`✓ Message: ${firstLine}`);

  return true;
}

const config = loadConfig();
const commitMessage = getCommitMessage();

if (!validateCommitMessage(commitMessage, config)) {
  process.exit(1);
}
