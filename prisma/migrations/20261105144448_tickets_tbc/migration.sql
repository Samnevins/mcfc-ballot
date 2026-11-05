-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opponent" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "homeAway" TEXT NOT NULL DEFAULT 'HOME',
    "competition" TEXT NOT NULL DEFAULT 'PREMIER_LEAGUE',
    "kickoff" DATETIME NOT NULL,
    "applicationDeadline" DATETIME NOT NULL,
    "drawAt" DATETIME NOT NULL,
    "ticketsAvailable" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Game" ("applicationDeadline", "competition", "createdAt", "drawAt", "homeAway", "id", "kickoff", "opponent", "ticketsAvailable", "venue") SELECT "applicationDeadline", "competition", "createdAt", "drawAt", "homeAway", "id", "kickoff", "opponent", "ticketsAvailable", "venue" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
