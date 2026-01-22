/*
  Warnings:

  - You are about to drop the `fiat_orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kyc_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_methods` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "fiat_orders" DROP CONSTRAINT "fiat_orders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "kyc_documents" DROP CONSTRAINT "kyc_documents_application_id_fkey";

-- DropForeignKey
ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_user_id_fkey";

-- DropTable
DROP TABLE "fiat_orders";

-- DropTable
DROP TABLE "kyc_documents";

-- DropTable
DROP TABLE "payment_methods";
