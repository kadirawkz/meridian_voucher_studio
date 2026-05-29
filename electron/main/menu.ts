import { app, BrowserWindow, Menu, shell } from "electron";
import type { MenuItemConstructorOptions } from "electron";

export function createNativeMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Voucher",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow.webContents.send("menu:navigate", "entry"),
        },
        {
          label: "Save Voucher",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu:save-voucher"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        {
          label: "Search",
          accelerator: "CmdOrCtrl+K",
          click: () => mainWindow.webContents.send("menu:search-focus"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        ...(!app.isPackaged ? [{ role: "toggleDevTools" as const }] : []),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Navigation",
      submenu: [
        {
          label: "Open Dashboard",
          accelerator: "CmdOrCtrl+D",
          click: () =>
            mainWindow.webContents.send("menu:navigate", "dashboard"),
        },
        {
          label: "Voucher Entry",
          click: () => mainWindow.webContents.send("menu:navigate", "entry"),
        },
      ],
    },
    {
      label: "Rate Master",
      submenu: [
        {
          label: "Manage Existing Rates",
          accelerator: "CmdOrCtrl+R",
          click: () =>
            mainWindow.webContents.send("menu:navigate", "manage-rates"),
        },
        {
          label: "Add New Rate",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () =>
            mainWindow.webContents.send("menu:navigate", "rate-master"),
        },
      ],
    },
    {
      label: "Voucher",
      submenu: [
        {
          label: "Generate PDF",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow.webContents.send("menu:generate-pdf"),
        },
        {
          label: "Generate DOCX",
          accelerator: "CmdOrCtrl+L",
          click: () => mainWindow.webContents.send("menu:generate-docx"),
        },
      ],
    },
    {
      label: "Reports",
      submenu: [{ label: "Coming Soon...", enabled: false }],
    },
    {
      label: "Account",
      submenu: [
        {
          label: "Profile",
          click: () => mainWindow.webContents.send("menu:account", "profile"),
        },
        {
          label: "Settings",
          click: () => mainWindow.webContents.send("menu:account", "settings"),
        },
        { type: "separator" },
        {
          label: "Sign Out",
          accelerator: "CmdOrCtrl+Shift+Q",
          click: () => mainWindow.webContents.send("menu:sign-out"),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Supabase Dashboard",
          click: () => shell.openExternal("https://supabase.com/dashboard"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
