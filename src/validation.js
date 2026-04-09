function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validateName(name) {
  if (!name) {
    return "Заполните имя.";
  }
  if (name.length < 2) {
    return "Имя слишком короткое.";
  }
  return "";
}

function validateEmail(email) {
  if (!email) {
    return "Заполните email.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Некорректный email.";
  }
  return "";
}

function validateInviteForm(body) {
  const note = normalizeText(body.note, 200);
  const maxUses = Number(body.maxUses || 1);
  const expiresAtDate = body.expiresAt ? new Date(body.expiresAt) : null;

  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
    return { ok: false, error: "Количество использований должно быть от 1 до 1000." };
  }

  if (expiresAtDate && Number.isNaN(expiresAtDate.getTime())) {
    return { ok: false, error: "Неверно указана дата окончания приглашения." };
  }

  return {
    ok: true,
    note,
    maxUses,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : null
  };
}

module.exports = {
  normalizeText,
  validateName,
  validateEmail,
  validateInviteForm
};
