/*
  Warnings:

  - You are about to drop the `MarketplaceConnection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OAuthState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MarketplaceConnection" DROP CONSTRAINT "MarketplaceConnection_userId_fkey";

-- DropForeignKey
ALTER TABLE "OAuthState" DROP CONSTRAINT "OAuthState_userId_fkey";

-- DropTable
DROP TABLE "MarketplaceConnection";

-- DropTable
DROP TABLE "OAuthState";

-- DropEnum
DROP TYPE "ConnectionStatus";
