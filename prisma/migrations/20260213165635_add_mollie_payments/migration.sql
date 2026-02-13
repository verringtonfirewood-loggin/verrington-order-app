/*
  Warnings:

  - A unique constraint covering the columns `[molliePaymentId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Order` ADD COLUMN `checkoutPaymentMethod` ENUM('MOLLIE', 'CASH', 'BACS') NOT NULL DEFAULT 'BACS',
    ADD COLUMN `mollieCheckoutUrl` VARCHAR(191) NULL,
    ADD COLUMN `molliePaymentId` VARCHAR(191) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentStatus` ENUM('UNPAID', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELED') NOT NULL DEFAULT 'UNPAID';

-- CreateIndex
CREATE UNIQUE INDEX `Order_molliePaymentId_key` ON `Order`(`molliePaymentId`);
