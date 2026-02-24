/**
 * Script de seed opcional: cria usuários admin e cliente no Firebase Auth + Firestore
 * e, opcionalmente, estações e carregadores de exemplo.
 *
 * Uso:
 *   1. Gere uma chave de conta de serviço no Firebase Console (Project settings > Service accounts).
 *   2. Defina GOOGLE_APPLICATION_CREDENTIALS apontando para o arquivo JSON da chave.
 *   3. Defina as variáveis abaixo (ou use os valores padrão) e execute:
 *      node scripts/seed.js
 *
 * Variáveis de ambiente:
 *   GOOGLE_APPLICATION_CREDENTIALS  - Caminho para o JSON da conta de serviço (obrigatório)
 *   ADMIN_EMAIL                     - E-mail do admin (default: admin@evcharge.com)
 *   ADMIN_PASSWORD                  - Senha do admin (default: password123)
 *   ADMIN_NAME                      - Nome do admin (default: Admin EV Charge)
 *   CLIENT_EMAIL                    - E-mail do cliente (default: cliente@email.com)
 *   CLIENT_PASSWORD                 - Senha do cliente (default: password123)
 *   CLIENT_NAME                     - Nome do cliente (default: Cliente Demo)
 *   SEED_STATIONS                   - "true" para criar estações e carregadores de exemplo (default: false)
 */

const admin = require("firebase-admin");
const path = require("path");

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho do JSON da conta de serviço.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(credPath))) });
}

const auth = admin.auth();
const db = admin.firestore();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@evcharge.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin EV Charge";
const CLIENT_EMAIL = process.env.CLIENT_EMAIL || "cliente@email.com";
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD || "password123";
const CLIENT_NAME = process.env.CLIENT_NAME || "Cliente Demo";
const SEED_STATIONS = process.env.SEED_STATIONS === "true";

async function createUser(email, password, displayName, role) {
  try {
    const user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    const now = admin.firestore.Timestamp.now();
    await db.doc(`users/${user.uid}`).set({
      email,
      name: displayName,
      role,
      created_at: now,
      updated_at: now,
    });
    console.log(`  Criado ${role}: ${email} (uid: ${user.uid})`);
    return user.uid;
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      console.log(`  ${role} já existe: ${email} (uid: ${existing.uid})`);
      return existing.uid;
    }
    throw e;
  }
}

async function seedStations(ownerId) {
  const now = admin.firestore.Timestamp.now();
  const stations = [
    {
      name: "Shopping Ibirapuera",
      address: "Av. Ibirapuera, 3103 - São Paulo, SP",
      city: "São Paulo",
      state: "SP",
      latitude: -23.5965,
      longitude: -46.6579,
      price_per_kwh: 0.89,
      status: "active",
      owner_id: ownerId,
      created_at: now,
      updated_at: now,
    },
    {
      name: "Estação Paulista",
      address: "Av. Paulista, 1578 - São Paulo, SP",
      city: "São Paulo",
      state: "SP",
      latitude: -23.5613,
      longitude: -46.6565,
      price_per_kwh: 0.95,
      status: "active",
      owner_id: ownerId,
      created_at: now,
      updated_at: now,
    },
  ];

  const chargerTemplates = [
    { charger_number: "01", connector_type: "CCS2", power_output: "50 kW", status: "available" },
    { charger_number: "02", connector_type: "CHAdeMO", power_output: "50 kW", status: "available" },
    { charger_number: "03", connector_type: "Type 2", power_output: "22 kW", status: "available" },
  ];

  for (const station of stations) {
    const ref = await db.collection("stations").add(station);
    console.log(`  Estação criada: ${station.name} (id: ${ref.id})`);
    for (const t of chargerTemplates) {
      await db.collection("chargers").add({
        station_id: ref.id,
        ...t,
      });
    }
    console.log(`    3 carregadores adicionados.`);
  }
}

async function main() {
  console.log("Seed: criando usuários...");
  const adminUid = await createUser(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, "admin");
  const clientUid = await createUser(CLIENT_EMAIL, CLIENT_PASSWORD, CLIENT_NAME, "user");
  console.log("Usuários OK.\n");

  if (SEED_STATIONS) {
    console.log("Seed: criando estações e carregadores de exemplo...");
    await seedStations(adminUid);
    console.log("Estações e carregadores OK.\n");
  } else {
    console.log("Para criar estações e carregadores de exemplo, execute com SEED_STATIONS=true\n");
  }

  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
