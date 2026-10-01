const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || "./data.json";

let data = {
  users: [],
  messages: []
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    console.log("Could not read data file");
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // Home
    if (req.method === "GET" && url.pathname === "/") {
      send(res, 200, {
        ok: true,
        message: "سرور پیام‌رسان فعال است"
      });
      return;
    }

    // Health
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true });
      return;
    }

    // Register
    if (req.method === "POST" && url.pathname === "/register") {
      const body = await readBody(req);

      const name = String(body.name || "").trim();
      const username = String(body.username || "")
        .trim()
        .toLowerCase();

      if (!name || !username) {
        send(res, 400, {
          ok: false,
          error: "نام و آیدی الزامی است"
        });
        return;
      }

      const exists = data.users.find(
        u => u.username === username
      );

      if (exists) {
        send(res, 409, {
          ok: false,
          error: "این آیدی قبلاً استفاده شده است",
          user: exists
        });
        return;
      }

      const user = {
        uid: crypto.randomUUID(),
        name,
        username,
        createdAt: Date.now()
      };

      data.users.push(user);
      saveData();

      send(res, 200, {
        ok: true,
        user
      });

      return;
    }

    // Find user
    if (req.method === "GET" && url.pathname === "/user") {
      const username = String(
        url.searchParams.get("username") || ""
      )
        .trim()
        .toLowerCase();

      const user = data.users.find(
        u => u.username === username
      );

      if (!user) {
        send(res, 404, {
          ok: false,
          error: "کاربر پیدا نشد"
        });
        return;
      }

      send(res, 200, {
        ok: true,
        user
      });

      return;
    }

    // Send message
    if (req.method === "POST" && url.pathname === "/message") {
      const body = await readBody(req);

      const chatId = String(body.chatId || "");
      const senderUid = String(body.senderUid || "");
      const senderName = String(body.senderName || "");
      const text = String(body.text || "").trim();

      if (!chatId || !senderUid || !text) {
        send(res, 400, {
          ok: false,
          error: "اطلاعات پیام ناقص است"
        });
        return;
      }

      const message = {
        id: crypto.randomUUID(),
        chatId,
        senderUid,
        senderName,
        text,
        createdAt: Date.now()
      };

      data.messages.push(message);

      // Keep last 10000 messages
      if (data.messages.length > 10000) {
        data.messages = data.messages.slice(-10000);
      }

      saveData();

      send(res, 200, {
        ok: true,
        message
      });

      return;
    }

    // Get messages
    if (req.method === "GET" && url.pathname === "/messages") {
      const chatId = String(
        url.searchParams.get("chatId") || ""
      );

      const messages = data.messages
        .filter(m => m.chatId === chatId)
        .slice(-300);

      send(res, 200, {
        ok: true,
        messages
      });

      return;
    }

    send(res, 404, {
      ok: false,
      error: "مسیر پیدا نشد"
    });

  } catch (error) {
    console.error(error);

    send(res, 500, {
      ok: false,
      error: "خطای داخلی سرور"
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Messenger server running on port ${PORT}`);
});
