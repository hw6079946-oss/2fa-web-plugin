const STORAGE_KEY = 'totp_vault';

const state = {
  masterPassword: '',
  accounts: [],
  timerId: null,
  activeModal: null
};

const ui = {
  authScreen: document.getElementById('auth-screen'),
  appScreen: document.getElementById('app-screen'),
  unlockForm: document.getElementById('unlock-form'),
  masterPassword: document.getElementById('master-password'),
  authError: document.getElementById('auth-error'),
  firstTimeBtn: document.getElementById('first-time-btn'),
  addAccountBtn: document.getElementById('add-account-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  searchInput: document.getElementById('search-input'),
  emptyState: document.getElementById('empty-state'),
  accountList: document.getElementById('account-list'),
  modalOverlay: document.getElementById('modal-overlay'),
  settingsModal: document.getElementById('settings-modal'),
  modalTitle: document.getElementById('modal-title'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
  accountForm: document.getElementById('account-form'),
  issuer: document.getElementById('issuer'),
  username: document.getElementById('username'),
  secret: document.getElementById('secret'),
  uri: document.getElementById('uri'),
  digits: document.getElementById('digits'),
  period: document.getElementById('period'),
  algorithm: document.getElementById('algorithm'),
  note: document.getElementById('note'),
  closeSettingsBtn: document.querySelector('.close-settings-btn'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importFile: document.getElementById('import-file'),
  deleteAllBtn: document.getElementById('delete-all-btn')
};

function init() {
  bindEvents();
  showAuthScreen();
  startClock();
}

function bindEvents() {
  ui.unlockForm.addEventListener('submit', handleUnlock);
  ui.firstTimeBtn.addEventListener('click', () => {
    ui.masterPassword.focus();
    ui.authError.textContent = '首次使用请输入新密码并解锁；系统会自动保存数据。';
  });

  ui.addAccountBtn.addEventListener('click', () => openAccountModal());
  ui.settingsBtn.addEventListener('click', openSettingsModal);
  ui.logoutBtn.addEventListener('click', logout);
  ui.searchInput.addEventListener('input', renderAccounts);
  ui.closeModalBtn.addEventListener('click', closeAccountModal);
  ui.cancelBtn.addEventListener('click', closeAccountModal);
  ui.accountForm.addEventListener('submit', handleSaveAccount);
  ui.modalOverlay.addEventListener('click', (event) => {
    if (event.target === ui.modalOverlay) closeAccountModal();
  });
  ui.closeSettingsBtn.addEventListener('click', closeSettingsModal);
  ui.settingsModal.addEventListener('click', (event) => {
    if (event.target === ui.settingsModal) closeSettingsModal();
  });

  ui.exportBtn.addEventListener('click', exportData);
  ui.importBtn.addEventListener('click', () => ui.importFile.click());
  ui.importFile.addEventListener('change', importData);
  ui.deleteAllBtn.addEventListener('click', deleteAllData);
}

function showAuthScreen() {
  ui.authScreen.classList.add('active');
  ui.appScreen.classList.remove('active');
  closeAccountModal();
  closeSettingsModal();
}

function showAppScreen() {
  ui.authScreen.classList.remove('active');
  ui.appScreen.classList.add('active');
  closeAccountModal();
  closeSettingsModal();
}

function startClock() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (state.masterPassword && state.accounts.length) {
      renderAccounts();
    }
  }, 1000);
}

async function handleUnlock(event) {
  event.preventDefault();
  const password = ui.masterPassword.value.trim();

  if (!password || password.length < 6) {
    ui.authError.textContent = '密码至少 6 位';
    return;
  }

  try {
    const stored = await readVault();
    if (stored) {
      try {
        const accounts = await decryptVault(stored, password);
        state.accounts = Array.isArray(accounts) ? accounts : [];
      } catch (error) {
        ui.authError.textContent = '密码错误或数据损坏';
        return;
      }
    } else {
      state.accounts = [];
      await persistVault();
    }

    state.masterPassword = password;
    ui.authError.textContent = '';
    ui.masterPassword.value = '';
    showAppScreen();
    await renderAccounts();
  } catch (error) {
    console.error(error);
    ui.authError.textContent = '解锁失败，请重试';
  }
}

function logout() {
  state.masterPassword = '';
  state.accounts = [];
  ui.authError.textContent = '';
  ui.masterPassword.value = '';
  showAuthScreen();
}

function openAccountModal(account = null) {
  resetAccountForm();

  if (account) {
    ui.modalTitle.textContent = '编辑账户';
    ui.issuer.value = account.issuer || '';
    ui.username.value = account.username || '';
    ui.secret.value = account.secret || '';
    ui.uri.value = '';
    ui.digits.value = String(account.digits || 6);
    ui.period.value = String(account.period || 30);
    ui.algorithm.value = account.algorithm || 'SHA1';
    ui.note.value = account.note || '';
    ui.accountForm.dataset.editId = String(account.id);
  } else {
    ui.modalTitle.textContent = '添加账户';
    delete ui.accountForm.dataset.editId;
  }

  ui.modalOverlay.classList.remove('hidden');
}

function closeAccountModal() {
  ui.modalOverlay.classList.add('hidden');
  resetAccountForm();
}

function resetAccountForm() {
  ui.accountForm.reset();
  ui.issuer.value = '';
  ui.username.value = '';
  ui.secret.value = '';
  ui.uri.value = '';
  ui.digits.value = '6';
  ui.period.value = '30';
  ui.algorithm.value = 'SHA1';
  ui.note.value = '';
  delete ui.accountForm.dataset.editId;
}

function openSettingsModal() {
  ui.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  ui.settingsModal.classList.add('hidden');
}

async function handleSaveAccount(event) {
  event.preventDefault();

  const uri = (ui.uri.value || '').trim();
  let account = {
    issuer: (ui.issuer.value || '').trim(),
    username: (ui.username.value || '').trim(),
    secret: (ui.secret.value || '').trim(),
    note: (ui.note.value || '').trim(),
    digits: Number(ui.digits.value || 6),
    period: Number(ui.period.value || 30),
    algorithm: (ui.algorithm.value || 'SHA1').toUpperCase()
  };

  if (uri) {
    const parsed = parseTotpUri(uri);
    if (!parsed) {
      ui.authError.textContent = 'otpauth URI 格式不正确';
      return;
    }
    account = { ...parsed, ...account };
  }

  if (!account.secret) {
    ui.authError.textContent = '密钥不能为空';
    return;
  }

  account.secret = account.secret.replace(/[\s\-=]+/g, '').toUpperCase();
  account.digits = [6, 8].includes(account.digits) ? account.digits : 6;
  account.period = [30, 60].includes(account.period) ? account.period : 30;
  account.algorithm = ['SHA1', 'SHA256', 'SHA512'].includes(account.algorithm) ? account.algorithm : 'SHA1';

  if (!account.issuer && !account.username) {
    ui.authError.textContent = '服务商或用户名至少填写一个';
    return;
  }

  const editId = ui.accountForm.dataset.editId;
  if (editId) {
    state.accounts = state.accounts.map((item) => item.id === Number(editId) ? { ...item, ...account, id: Number(editId) } : item);
  } else {
    state.accounts.push({ ...account, id: Date.now() });
  }

  await persistVault();
  closeAccountModal();
  await renderAccounts();
}

async function deleteAccount(accountId) {
  state.accounts = state.accounts.filter((item) => item.id !== accountId);
  await persistVault();
  await renderAccounts();
}

async function exportData() {
  const blob = new Blob([JSON.stringify(state.accounts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '2fa-web-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('invalid-json');
    }
    state.accounts = parsed;
    await persistVault();
    await renderAccounts();
    ui.importFile.value = '';
  } catch (error) {
    console.error(error);
    ui.authError.textContent = '导入失败，文件内容不是合法的账户列表';
  }
}

async function deleteAllData() {
  if (!confirm('确认删除全部验证码数据？')) return;
  state.accounts = [];
  await chrome.storage.local.remove([STORAGE_KEY]);
  await renderAccounts();
}

async function renderAccounts() {
  const filter = ui.searchInput.value.trim().toLowerCase();
  const visible = state.accounts.filter((item) => {
    const haystack = `${item.issuer || ''} ${item.username || ''} ${item.note || ''}`.toLowerCase();
    return haystack.includes(filter);
  });

  ui.accountList.innerHTML = '';

  if (!visible.length) {
    ui.emptyState.classList.remove('hidden');
    return;
  }

  ui.emptyState.classList.add('hidden');

  for (const account of visible) {
    const totp = await generateTotp(account.secret, account.digits, account.period, account.algorithm);
    const remaining = Math.max(0, totp.remaining);
    const expiring = remaining <= 5;

    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-top">
        <div class="account-info">
          <div class="account-issuer">${safeHtml(account.issuer || 'Unspecified')}</div>
          <div class="account-username">${safeHtml(account.username || 'Unknown')}</div>
        </div>
        <div class="account-actions">
          <button class="action-btn copy-btn" title="复制">⧉</button>
          <button class="action-btn edit-btn" title="编辑">✎</button>
          <button class="action-btn delete-btn" title="删除">🗑</button>
        </div>
      </div>
      <div class="code-row">
        <div class="totp-code ${expiring ? 'expiring' : ''}">${totp.code}</div>
        <div class="timer ${expiring ? 'expiring' : ''}">${remaining}s</div>
      </div>
      <div class="account-note">${safeHtml(account.note || `${account.period}s · ${account.algorithm}`)}</div>
    `;

    card.querySelector('.copy-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(totp.code);
      } catch (error) {
        console.log('Copy failed', error);
      }
    });

    card.querySelector('.edit-btn').addEventListener('click', () => openAccountModal(account));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteAccount(account.id));

    ui.accountList.appendChild(card);
  }
}

async function readVault() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

async function persistVault() {
  if (!state.masterPassword) return;
  const encrypted = await encryptVault(state.accounts, state.masterPassword);
  await chrome.storage.local.set({ [STORAGE_KEY]: encrypted });
}

async function encryptVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    iv: bytesToHex(iv),
    salt: bytesToHex(salt),
    data: bytesToHex(new Uint8Array(encrypted))
  };
}

async function decryptVault(payload, password) {
  const key = await deriveKey(password, hexToBytes(payload.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(payload.iv) },
    key,
    hexToBytes(payload.data)
  );
  const decoded = new TextDecoder().decode(decrypted);
  const parsed = JSON.parse(decoded);
  return Array.isArray(parsed) ? parsed : [];
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 200000
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

init();
