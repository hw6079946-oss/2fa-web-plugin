# 2FA Web Authenticator - Pure Chrome Extension

**本仓库已改造成 Chrome 浏览器插件版本，所有验证码数据只保存在浏览器本地。**

## 目录结构

```
.
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
├── crypto-utils.js
├── LICENSE
├── README.md
└── .gitignore
```

## 安装使用

1. 打开 Chrome 浏览器
2. 进入 `chrome://extensions`
3. 打开右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择当前项目目录
6. 插件图标会出现在工具栏中

## 功能

- 主密码保护
- 本地加密存储（AES-256-GCM + PBKDF2）
- TOTP 6/8 位验证码生成
- 30s / 60s 周期支持
- SHA1 / SHA256 / SHA512 算法
- otpauth URI 自动识别
- 批量添加/编辑/删除账户
- 搜索账户
- 导入 / 导出备份 JSON
- 一键复制验证码

## 安全说明

- 数据不上传服务器
- 密钥保存在浏览器的 `chrome.storage.local`
- 通过主密码进行解锁
- 关键数据使用 Web Crypto API 加密

## 运行效果

安装后，点击扩展图标即可开启弹窗，输入主密码解锁后即可管理所有 TOTP 账户。

## 注意

这是纯 Chrome 插件版本，不再包含原先的 Flask Web 服务和 Python 后端。
