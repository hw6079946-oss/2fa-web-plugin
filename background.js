// Service Worker for Chrome Extension
// 处理插件的后台逻辑和存储

const VAULT_KEY = 'totp_vault_encrypted';
const MASTER_PASSWORD_KEY = 'master_password_hash';

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('2FA Web Authenticator installed');
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVault') {
    chrome.storage.local.get([VAULT_KEY], (result) => {
      sendResponse({ vault: result[VAULT_KEY] || null });
    });
    return true;
  }
  if (request.action === 'saveVault') {
    chrome.storage.local.set({ [VAULT_KEY]: request.vault }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'clearStorage') {
    chrome.storage.local.clear(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
