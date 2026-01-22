-- CreateEnum
CREATE TYPE "FiatTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "FiatPaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'PAYPAL');

-- CreateEnum
CREATE TYPE "FiatTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "price_alerts" ADD COLUMN     "last_price" DECIMAL(20,8),
ADD COLUMN     "triggered_at" TIMESTAMP(3),
ADD COLUMN     "triggered_price" DECIMAL(20,8);

-- CreateTable
CREATE TABLE "fiat_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "FiatTransactionType" NOT NULL,
    "fiat_currency" TEXT NOT NULL,
    "fiat_amount" DECIMAL(18,2) NOT NULL,
    "crypto_symbol" TEXT,
    "crypto_amount" DECIMAL(36,18),
    "method" "FiatPaymentMethod" NOT NULL,
    "status" "FiatTransactionStatus" NOT NULL,
    "provider" TEXT,
    "metadata" JSONB,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiat_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fiat_transactions" ADD CONSTRAINT "fiat_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
