/*
  Warnings:

  - A unique constraint covering the columns `[transaction_id]` on the table `fiat_transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `fiat_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FiatPaymentMethod" ADD VALUE 'VNPAY';
ALTER TYPE "FiatPaymentMethod" ADD VALUE 'MOMO';
ALTER TYPE "FiatPaymentMethod" ADD VALUE 'ZALOPAY';
ALTER TYPE "FiatPaymentMethod" ADD VALUE 'STRIPE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FiatTransactionStatus" ADD VALUE 'APPROVED';
ALTER TYPE "FiatTransactionStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "FiatTransactionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "fiat_transactions" ADD COLUMN     "admin_note" TEXT,
ADD COLUMN     "bank_account_id" TEXT,
ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_account_number" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "fee" DECIMAL(18,2),
ADD COLUMN     "gateway_response" JSONB,
ADD COLUMN     "net_amount" DECIMAL(18,2),
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "processed_by_id" TEXT,
ADD COLUMN     "transaction_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "price_alert_sound" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "push_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "theme_color" TEXT NOT NULL DEFAULT '#3B82F6',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
ADD COLUMN     "trading_confirmation" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "bank_code" TEXT,
    "account_number" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "branch" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_user_id_account_number_bank_code_key" ON "bank_accounts"("user_id", "account_number", "bank_code");

-- CreateIndex
CREATE UNIQUE INDEX "fiat_transactions_transaction_id_key" ON "fiat_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "fiat_transactions_user_id_idx" ON "fiat_transactions"("user_id");

-- CreateIndex
CREATE INDEX "fiat_transactions_status_idx" ON "fiat_transactions"("status");

-- CreateIndex
CREATE INDEX "fiat_transactions_transaction_id_idx" ON "fiat_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "fiat_transactions_type_idx" ON "fiat_transactions"("type");

-- AddForeignKey
ALTER TABLE "fiat_transactions" ADD CONSTRAINT "fiat_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiat_transactions" ADD CONSTRAINT "fiat_transactions_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
