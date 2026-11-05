import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const day = 86400_000;
const at = (days: number, hourUtc = 15) => {
  const d = new Date(Date.now() + days * day);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
};

async function main() {
  await db.$transaction([
    db.allocation.deleteMany(), db.draw.deleteMany(), db.application.deleteMany(),
    db.weightLog.deleteMany(), db.game.deleteMany(), db.user.deleteMany(), db.settings.deleteMany(),
  ]);
  await db.settings.create({ data: { id: 1, weightIncrement: 0.5, reducedMultiplier: 0.5, acceptWindowHours: 48 } });

  await db.user.create({
    data: { email: "admin@example.com", name: "Club Admin", role: "ADMIN", passwordHash: await bcrypt.hash("admin123", 10) },
  });
  const pw = await bcrypt.hash("password123", 10);
  const names = ["Alex Ward", "Bea Patel", "Callum Reid", "Dee Okafor", "Eli Shaw", "Fran Nolan", "Gus Byrne", "Hana Ito", "Ian Doyle", "Jo Mensah"];
  const supporters = [];
  for (const [i, name] of names.entries()) {
    supporters.push(await db.user.create({ data: { email: `supporter${i + 1}@example.com`, name, passwordHash: pw } }));
  }

  // 1: deadline passed, awaiting draw (8 applicants) — admin can run the draw immediately
  const g1 = await db.game.create({
    data: { opponent: "Arsenal", venue: "Emirates Stadium, London", kickoff: at(10), applicationDeadline: at(-1, 12), drawAt: at(0, 18), ticketsAvailable: 4 },
  });
  // 2: open for applications
  const g2 = await db.game.create({
    data: { opponent: "Chelsea", venue: "Stamford Bridge, London", kickoff: at(24, 17), applicationDeadline: at(12, 12), drawAt: at(13, 18), ticketsAvailable: 3 },
  });
  // 3: open, later
  await db.game.create({
    data: { opponent: "Tottenham Hotspur", venue: "Tottenham Hotspur Stadium, London", kickoff: at(40, 20), applicationDeadline: at(28, 12), drawAt: at(29, 18), ticketsAvailable: 5 },
  });

  for (const s of supporters.slice(0, 8)) await db.application.create({ data: { userId: s.id, gameId: g1.id } });
  for (const s of supporters.slice(3, 7)) await db.application.create({ data: { userId: s.id, gameId: g2.id } });

  console.log("Seeded: admin@example.com / admin123, supporter1..10@example.com / password123");
}

main().finally(() => db.$disconnect());
