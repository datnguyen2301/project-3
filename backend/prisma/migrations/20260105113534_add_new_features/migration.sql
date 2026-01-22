-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderType" ADD VALUE 'STOP_LOSS_LIMIT';
ALTER TYPE "OrderType" ADD VALUE 'TAKE_PROFIT';
ALTER TYPE "OrderType" ADD VALUE 'TAKE_PROFIT_LIMIT';
ALTER TYPE "OrderType" ADD VALUE 'TRAILING_STOP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'MARGIN_BORROW';
ALTER TYPE "WalletTransactionType" ADD VALUE 'MARGIN_REPAY';

-- AlterTable
ALTER TABLE "kyc_applications" ADD COLUMN     "back_document_url" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "document_expiry" DATE,
ADD COLUMN     "document_number" TEXT,
ADD COLUMN     "document_type" TEXT,
ADD COLUMN     "front_document_url" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "selfie_url" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ALTER COLUMN "level" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "linked_order_id" TEXT,
ADD COLUMN     "trailing_delta" DECIMAL(36,8);

-- AlterTable
ALTER TABLE "portfolio_history" ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "total_pnl" DECIMAL(36,8) NOT NULL DEFAULT 0,
ADD COLUMN     "total_pnl_percentage" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "two_fa_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "favorite_pairs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "target_price" DECIMAL(20,8) NOT NULL,
    "condition" TEXT NOT NULL,
    "note" TEXT,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "order_filled" BOOLEAN NOT NULL DEFAULT true,
    "price_alert" BOOLEAN NOT NULL DEFAULT true,
    "deposit" BOOLEAN NOT NULL DEFAULT true,
    "withdrawal" BOOLEAN NOT NULL DEFAULT true,
    "security" BOOLEAN NOT NULL DEFAULT true,
    "marketing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_pairs_user_id_symbol_key" ON "favorite_pairs"("user_id", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");
