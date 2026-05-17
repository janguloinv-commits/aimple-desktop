let currentFolderPath = null;
let messageHistory = [];

// Initialize app - hide setup modal since it's not needed
async function initializeApp() {
  hideSetupModal();
}

// Select Folder
async function selectFolder() {
  try {
    const result = await window.electron.selectFolder();

    if (!result) {
      return;
    }

    currentFolderPath = result.path;

    // Update folder info display
    const folderInfo = document.getElementById('folderInfo');
    folderInfo.innerHTML = `
      <strong>Selected Folder:</strong>
      <div class="folder-path">${result.path}</div>
    `;

    // Display folder structure
    displayFolderStructure(result.structure);

    // Enable question input
    document.getElementById('question').disabled = false;
    document.getElementById('sendBtn').disabled = false;

    // Clear previous messages
    messageHistory = [];
    document.getElementById('messages').innerHTML = '';

  } catch (error) {
    showError(`Error selecting folder: ${error.message}`);
  }
}

// Display folder structure as tree
function displayFolderStructure(structure) {
  const treeContainer = document.getElementById('treeContainer');
  const folderTree = document.getElementById('folderTree');

  folderTree.innerHTML = '';
  buildTreeHTML(structure, folderTree, 0);
  treeContainer.style.display = 'block';
}

function buildTreeHTML(item, container, depth) {
  if (depth > 5) return; // Limit depth

  const div = document.createElement('div');
  div.className = `tree-item ${item.type}`;
  div.style.paddingLeft = `${depth * 15}px`;

  const name = item.name || 'Unknown';
  div.textContent = name;
  container.appendChild(div);

  // Add children for folders
  if (item.type === 'folder' && item.children && item.children.length > 0) {
    for (const child of item.children) {
      buildTreeHTML(child, container, depth + 1);
    }
  }
}

// Send question to Claude
async function sendQuestion() {
  if (!currentFolderPath) {
    showError('Please select a folder first');
    return;
  }

  const question = document.getElementById('question').value.trim();
  if (!question) {
    return;
  }

  // Disable input while processing
  document.getElementById('question').disabled = true;
  document.getElementById('sendBtn').disabled = true;

  try {
    // Add user message to chat
    addMessage('user', question);
    document.getElementById('question').value = '';

    // Show loading state
    showLoading();

    // Query Claude
    const response = await window.electron.queryClause({
      question: question,
      folderPath: currentFolderPath,
    });

    // Remove loading state
    removeLoading();

    if (response.error) {
      showError(response.error);
    } else {
      addMessage('assistant', response.answer);

      // Add metadata
      const messagesDiv = document.getElementById('messages');
      const metaDiv = document.createElement('div');
      metaDiv.style.fontSize = '11px';
      metaDiv.style.color = '#999';
      metaDiv.style.paddingLeft = '10px';
      metaDiv.style.marginTop = '5px';
      metaDiv.textContent = `✓ Analyzed ${response.filesAnalyzed} file(s)`;
      messagesDiv.appendChild(metaDiv);
    }

  } catch (error) {
    removeLoading();
    showError(`Error: ${error.message}`);
  } finally {
    // Re-enable input
    document.getElementById('question').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('question').focus();
  }
}

// Add message to chat
function addMessage(role, text) {
  const messagesDiv = document.getElementById('messages');

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  contentDiv.textContent = text;

  messageDiv.appendChild(contentDiv);
  messagesDiv.appendChild(messageDiv);

  // Scroll to bottom
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  messageHistory.push({ role, text });
}

// Show loading indicator
function showLoading() {
  const messagesDiv = document.getElementById('messages');

  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading';
  loadingDiv.className = 'message assistant';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'loading';
  contentDiv.innerHTML = `
    <div class="spinner"></div>
    <span>Analyzing documents...</span>
  `;

  loadingDiv.appendChild(contentDiv);
  messagesDiv.appendChild(loadingDiv);

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Remove loading indicator
function removeLoading() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// Show error message
function showError(message) {
  const messagesDiv = document.getElementById('messages');

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;

  messagesDiv.appendChild(errorDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Initialize and handle events
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();

  // Question input event listener
  const questionInput = document.getElementById('question');
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  });
});
