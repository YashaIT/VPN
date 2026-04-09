const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = this.load();
  }

  load() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      const initialState = {
        invites: [],
        users: [],
        admins: [],
        meta: {
          nextClientOctet: null
        }
      };
      fs.writeFileSync(this.filePath, JSON.stringify(initialState, null, 2));
      return initialState;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  save() {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
    fs.copyFileSync(tempPath, this.filePath);
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Temporary file cleanup can fail on Windows due to short-lived file locks.
    }
  }

  ensureAdmin(admin) {
    const existing = this.state.admins.find((item) => item.username === admin.username);
    if (existing) {
      Object.assign(existing, admin);
      this.save();
      return existing;
    }

    const nextAdmin = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...admin
    };

    this.state.admins.push(nextAdmin);
    this.save();
    return nextAdmin;
  }

  findAdminByUsername(username) {
    return this.state.admins.find((item) => item.username === username) || null;
  }

  createInvite({ createdBy, expiresAt, maxUses = 1, note = "" }) {
    const invite = {
      id: crypto.randomUUID(),
      token: crypto.randomBytes(24).toString("hex"),
      createdAt: new Date().toISOString(),
      createdBy,
      expiresAt: expiresAt || null,
      maxUses,
      usedCount: 0,
      note
    };

    this.state.invites.unshift(invite);
    this.save();
    return invite;
  }

  listInvites() {
    return [...this.state.invites];
  }

  findInviteByToken(token) {
    return this.state.invites.find((item) => item.token === token) || null;
  }

  markInviteUsed(token) {
    const invite = this.findInviteByToken(token);
    if (!invite) {
      return null;
    }
    invite.usedCount += 1;
    this.save();
    return invite;
  }

  listUsers() {
    return [...this.state.users];
  }

  createUser(user) {
    const nextUser = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...user
    };

    this.state.users.unshift(nextUser);
    this.save();
    return nextUser;
  }

  findUserByEmail(email) {
    return this.state.users.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null;
  }

  findUserByDownloadToken(token) {
    return this.state.users.find((item) => item.downloadToken === token) || null;
  }

  findUserById(id) {
    return this.state.users.find((item) => item.id === id) || null;
  }

  getNextClientOctet(startAt) {
    if (!this.state.meta.nextClientOctet) {
      this.state.meta.nextClientOctet = startAt;
    }

    const nextValue = this.state.meta.nextClientOctet;
    this.state.meta.nextClientOctet += 1;
    this.save();
    return nextValue;
  }
}

module.exports = {
  JsonStore
};
