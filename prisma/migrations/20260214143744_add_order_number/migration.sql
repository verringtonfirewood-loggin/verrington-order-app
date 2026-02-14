/*
  Warnings:

  - A unique constraint covering the columns `[orderNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Order` ADD COLUMN `orderNumber` VARCHAR(191) NULL,
    MODIFY `customerPhone` VARCHAR(191) NULL,
    MODIFY `totalPence` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `lineTotalPence` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `OrderCounter` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `next` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_orderNumber_key` ON `Order`(`orderNumber`);

-- CreateIndex
CREATE INDEX `Order_paymentStatus_idx` ON `Order`(`paymentStatus`);
