const {app, BrowserWindow, ipcMain, Notification, dialog} = require("electron");
const path = require("path");
const axios = require("axios");
const {createWriteStream} = require("fs");
const RPC = require("discord-rpc");

app.setAppUserModelId("Osu Beatmaps");
function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minHeight: 600,
    minWidth: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "./public/favicon.ico"),
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "./main/index.html"));

  // Open the DevTools.
  // disabled menu
  mainWindow.setMenuBarVisibility(false);

  // mainWindow.webContents.openDevTools()
  sendNotification("App Started", "You can open the app now");
}

app.on("ready", createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on("setpath", function(event) {
  dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    properties: ["openDirectory"],
  }).then((result) => {
    event.sender.send("pathdata", result);
  });
});

ipcMain.on("download", async function(event, args) {
  const {stream, headers} = await downloadBeatmapset(args.id, args.token);
  const fileName = `${args.id} ${args.artist} - ${args.title}.osz`.replace(/[^0-9A-Za-z!@#$%^&()_+=[\]'. -]/g, "");
  const writeStream = createWriteStream(`${args.path}/${fileName}`);

  const totalLength = parseInt(headers["content-length"]);
  let dlLength = 0;

  stream.on("data", (chunk) => {
    dlLength += chunk.length;
    event.sender.send("downloading", {progress: `${Math.round(dlLength / totalLength * 100)}%`, id: args.id});
  });

  stream.on("end", () => {
    sendNotification("Downloader", `${args.title} - ${args.artist} has been downloaded!`);
    event.sender.send("downloading", {progress: "100%", id: args.id});
  });

  stream.pipe(writeStream);
});

async function downloadBeatmapset(mapsetId, accesstoken) {
  const api = axios.create({
    baseURL: "https://osu.ppy.sh/api/v2",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    },
  });

  const {data, headers} = await api.get(`/beatmapsets/${mapsetId}/download`, {
    responseType: "stream",
    headers: {
      "Authorization": `Bearer ${accesstoken}`,
    },
    timeout: 240e3,
  });
  return {
    stream: data,
    headers,
  };
}

function sendNotification(title, body) {
  if (Notification.isSupported() == true) {
    const copied = {
      title,
      body,
      icon: path.join(__dirname, "./public/favicon.ico"),
    };

    new Notification(copied).show();
  }
}

// rpc stuff
const rpc = new RPC.Client({
  transport: "ipc",
});

let hasRpc = false;
let state = true;
const rpcTimeStamp = Date.now();
ipcMain.on("rpcToggle", function(event, args) {
  if (args.toggle) {
    rpc.login({
      // ToDO Change ClientId
      clientId: "920720707367886908",
    });

    rpc.on("ready", function() {
      rpc.setActivity({
        details: "Main Menu",
        state: "On Main Menu",
        largeImageKey: "favicon",
        startTimestamp: rpcTimeStamp,
      });
    });

    ipcMain.on("rpcState", (e, args) => {
      if (state === false) return;
      rpc.setActivity({
        details: args.details,
        state: args.state,
        largeImageKey: "favicon",
        startTimestamp: rpcTimeStamp,
      });
    });
    state = true;
    hasRpc = true;
  } else if (!args.toggle && hasRpc) {
    rpc.clearActivity();
    state = false;
    hasrpc = false;
  }
});
