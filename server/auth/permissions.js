// Rollar: admin — rahbar, manager — sotuv/undiruv menejeri, cashier — kassir.
export const ROLES = {
  admin: "Rahbar (administrator)",
  manager: "Menejer",
  cashier: "Kassir",
};

export const PERMISSIONS = {
  "payments:create":  ["admin", "manager", "cashier"],
  "payments:update":  ["admin", "manager"],
  "payments:delete":  ["admin"],
  "contracts:upload": ["admin", "manager"],
  "sms:send":         ["admin", "manager"],
  "ai:use":           ["admin", "manager"],
  "import":           ["admin"],
  "users:manage":     ["admin"],
  "audit:view":       ["admin"],
  "apartments:edit":  ["admin"],
  "clients:edit":     ["admin", "manager"],
  "clients:delete":   ["admin"],
};

export const permissionsFor = (role) =>
  Object.entries(PERMISSIONS).filter(([, roles]) => roles.includes(role)).map(([p]) => p);
