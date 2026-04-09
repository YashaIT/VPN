function formatDate(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({ title, content }) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="shell">
    ${content}
  </main>
</body>
</html>`;
}

function badge(text, tone = "muted") {
  return `<span class="badge badge-${tone}">${escapeHtml(text)}</span>`;
}

function adminLoginPage(error = "", csrfToken = "") {
  return layout({
    title: "Admin login",
    content: `
      <section class="card narrow">
        <p class="eyebrow">VPN Admin</p>
        <h1>Вход администратора</h1>
        <p class="lead">Создавайте ссылки-приглашения и управляйте пользователями VPN.</p>
        ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
        <form method="post" action="/admin/login" class="stack">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
          <label>
            <span>Логин</span>
            <input name="username" required maxlength="64" />
          </label>
          <label>
            <span>Пароль</span>
            <input type="password" name="password" required maxlength="256" />
          </label>
          <button type="submit">Войти</button>
        </form>
      </section>
    `
  });
}

function adminDashboardPage({
  appOrigin,
  invites,
  users,
  csrfToken = "",
  error = "",
  message = "",
  vpnConfigPath = "",
  autoApplyPeers = false
}) {
  const inviteRows = invites
    .map((invite) => {
      const link = `${appOrigin}/register/${invite.token}`;
      const expired = invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now();
      const exhausted = invite.usedCount >= invite.maxUses;
      const status = expired
        ? badge("Истекла", "danger")
        : exhausted
          ? badge("Использована", "warning")
          : badge("Активна", "success");

      return `
        <tr>
          <td>${status}</td>
          <td><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></td>
          <td>${invite.usedCount}/${invite.maxUses}</td>
          <td>${escapeHtml(invite.note || "-")}</td>
          <td>${formatDate(invite.expiresAt)}</td>
          <td>${formatDate(invite.createdAt)}</td>
        </tr>
      `;
    })
    .join("");

  const userRows = users
    .map((user) => {
      const statusTone = user.wireGuardStatus === "applied" ? "success" : user.wireGuardStatus === "failed" ? "danger" : "warning";
      const statusLabel = user.wireGuardStatus === "applied" ? "Применен" : user.wireGuardStatus === "failed" ? "Ошибка" : "Вручную";

      return `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.address)}</td>
          <td>${badge(statusLabel, statusTone)}</td>
          <td><a href="/admin/users/${escapeHtml(user.id)}/peer">peer</a></td>
          <td>${formatDate(user.createdAt)}</td>
        </tr>
      `;
    })
    .join("");

  return layout({
    title: "Admin dashboard",
    content: `
      <section class="hero">
        <div>
          <p class="eyebrow">VPN Admin Panel</p>
          <h1>Приглашения и пользователи</h1>
          <p class="lead">Создайте одноразовую или многоразовую ссылку, которую администратор отправит пользователю для регистрации.</p>
        </div>
        <form method="post" action="/admin/logout">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
          <button type="submit" class="ghost">Выйти</button>
        </form>
      </section>

      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      ${message ? `<p class="success">${escapeHtml(message)}</p>` : ""}

      <section class="grid">
        <article class="card">
          <h2>Создать invite</h2>
          <form method="post" action="/admin/invites" class="stack">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
            <label>
              <span>Комментарий</span>
              <input name="note" maxlength="200" placeholder="Например: для команды маркетинга" />
            </label>
            <label>
              <span>Количество регистраций</span>
              <input type="number" min="1" max="1000" name="maxUses" value="1" />
            </label>
            <label>
              <span>Срок действия до</span>
              <input type="datetime-local" name="expiresAt" />
            </label>
            <button type="submit">Создать ссылку</button>
          </form>
        </article>

        <article class="card">
          <h2>Что получает пользователь</h2>
          <ul class="plain-list">
            <li>Форму регистрации по персональной ссылке</li>
            <li>Готовый WireGuard-конфиг после регистрации</li>
            <li>Файл <code>.conf</code>, который можно импортировать в клиентское приложение</li>
            <li>${autoApplyPeers ? `Peer автоматически добавляется в ${escapeHtml(vpnConfigPath || "конфигурацию WireGuard")}` : "Peer остается доступным для ручного добавления администратором"}</li>
          </ul>
        </article>
      </section>

      <section class="card">
        <h2>Ссылки приглашения</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Статус</th>
                <th>Ссылка</th>
                <th>Использования</th>
                <th>Комментарий</th>
                <th>Истекает</th>
                <th>Создана</th>
              </tr>
            </thead>
            <tbody>
              ${inviteRows || `<tr><td colspan="6">Приглашений пока нет.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Пользователи</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Адрес</th>
                <th>WireGuard</th>
                <th>Peer</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              ${userRows || `<tr><td colspan="6">Пользователей пока нет.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `
  });
}

function inviteInvalidPage(message) {
  return layout({
    title: "Invite invalid",
    content: `
      <section class="card narrow">
        <p class="eyebrow">Invite</p>
        <h1>Ссылка недоступна</h1>
        <p class="lead">${escapeHtml(message)}</p>
      </section>
    `
  });
}

function registerPage({ invite, error = "", values = {}, csrfToken = "" }) {
  return layout({
    title: "Register VPN user",
    content: `
      <section class="card narrow">
        <p class="eyebrow">VPN Registration</p>
        <h1>Регистрация пользователя</h1>
        <p class="lead">После регистрации сервис сгенерирует VPN-конфигурацию и сразу покажет ее для загрузки.</p>
        ${invite.note ? `<p class="hint">Комментарий администратора: ${escapeHtml(invite.note)}</p>` : ""}
        ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
        <form method="post" action="/register/${escapeHtml(invite.token)}" class="stack">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}" />
          <label>
            <span>Имя</span>
            <input name="name" value="${escapeHtml(values.name || "")}" required maxlength="120" />
          </label>
          <label>
            <span>Email</span>
            <input type="email" name="email" value="${escapeHtml(values.email || "")}" required maxlength="160" />
          </label>
          <button type="submit">Создать аккаунт и конфиг</button>
        </form>
      </section>
    `
  });
}

function registrationSuccessPage({ user, qrCodeDataUrl }) {
  const messageClass = user.wireGuardStatus === "applied" ? "success" : user.wireGuardStatus === "failed" ? "error" : "hint";

  return layout({
    title: "VPN config ready",
    content: `
      <section class="card">
        <p class="eyebrow">VPN Ready</p>
        <h1>Конфигурация готова</h1>
        <p class="lead">Пользователь <strong>${escapeHtml(user.name)}</strong> зарегистрирован. Ниже можно скачать конфиг и импортировать его в клиентское приложение.</p>
        <div class="actions">
          <a class="button" href="/download/${escapeHtml(user.downloadToken)}">Скачать .conf</a>
        </div>
        <p class="${messageClass}">${escapeHtml(user.wireGuardMessage || "")}</p>
        ${qrCodeDataUrl ? `
          <section class="qr-block">
            <h2>QR-код для мобильного импорта</h2>
            <img src="${escapeHtml(qrCodeDataUrl)}" alt="VPN QR code" class="qr-image" />
          </section>
        ` : ""}
        <section class="config-block">
          <h2>Содержимое конфигурации</h2>
          <pre>${escapeHtml(user.configText)}</pre>
        </section>
      </section>
    `
  });
}

module.exports = {
  adminLoginPage,
  adminDashboardPage,
  inviteInvalidPage,
  registerPage,
  registrationSuccessPage
};
