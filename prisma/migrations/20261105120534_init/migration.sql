-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPPORTER',
    "weight" REAL NOT NULL DEFAULT 1.0,
    "banGamesLeft" INTEGER NOT NULL DEFAULT 0,
    "reducedGamesLeft" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameId" TEXT,
    "reason" TEXT NOT NULL,
    "oldWeight" REAL NOT NULL,
    "newWeight" REAL NOT NULL,
    "banLeft" INTEGER NOT NULL,
    "reducedLeft" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeightLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opponent" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "kickoff" DATETIME NOT NULL,
    "applicationDeadline" DATETIME NOT NULL,
    "drawAt" DATETIME NOT NULL,
    "ticketsAvailable" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "inputJson" TEXT NOT NULL,
    "orderJson" TEXT NOT NULL,
    "ranById" TEXT NOT NULL,
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draw_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Draw_ranById_fkey" FOREIGN KEY ("ranById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondBy" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    CONSTRAINT "Allocation_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Allocation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Allocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "weightIncrement" REAL NOT NULL DEFAULT 0.5,
    "reducedMultiplier" REAL NOT NULL DEFAULT 0.5,
    "acceptWindowHours" INTEGER NOT NULL DEFAULT 48
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WeightLog_userId_idx" ON "WeightLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_gameId_key" ON "Application"("userId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Draw_gameId_round_key" ON "Draw"("gameId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_gameId_userId_key" ON "Allocation"("gameId", "userId");
