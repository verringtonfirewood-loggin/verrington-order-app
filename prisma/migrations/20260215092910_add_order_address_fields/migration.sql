/*
  Warnings:

  - You are about to drop the column `isActive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `Product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Product_isActive_sortOrder_idx` ON `Product`;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `addressLine1` VARCHAR(191) NULL,
    ADD COLUMN `addressLine2` VARCHAR(191) NULL,
    ADD COLUMN `county` VARCHAR(191) NULL,
    ADD COLUMN `town` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Product` DROP COLUMN `isActive`,
    DROP COLUMN `sortOrder`;

-- CreateIndex
CREATE INDEX `Product_createdAt_idx` ON `Product`(`createdAt`);
